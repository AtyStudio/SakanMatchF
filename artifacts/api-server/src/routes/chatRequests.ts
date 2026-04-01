import { Router } from "express";
import { db, chatRequestsTable, usersTable, userProfilesTable } from "@workspace/db";
import { eq, and, or } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, type AuthRequest } from "../middlewares/auth";

const router = Router();

const PG_UNIQUE_VIOLATION = "23505";

const createRequestSchema = z.object({
  receiverId: z.number().int().positive(),
});

function serializeRequest(row: {
  id: number;
  senderId: number;
  receiverId: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  senderName?: string | null;
  senderEmail?: string | null;
  senderAvatar?: string | null;
  receiverName?: string | null;
  receiverEmail?: string | null;
  receiverAvatar?: string | null;
}) {
  return {
    id: row.id,
    senderId: row.senderId,
    receiverId: row.receiverId,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    senderName: row.senderName ?? null,
    senderAvatar: row.senderAvatar ?? null,
    receiverName: row.receiverName ?? null,
    receiverAvatar: row.receiverAvatar ?? null,
  };
}

async function enrichRequest(req: {
  id: number;
  senderId: number;
  receiverId: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  const [sender] = await db
    .select({ name: usersTable.name })
    .from(usersTable)
    .where(eq(usersTable.id, req.senderId))
    .limit(1);

  const [senderProfile] = await db
    .select({ avatarUrl: userProfilesTable.avatarUrl })
    .from(userProfilesTable)
    .where(eq(userProfilesTable.userId, req.senderId))
    .limit(1);

  const [receiver] = await db
    .select({ name: usersTable.name })
    .from(usersTable)
    .where(eq(usersTable.id, req.receiverId))
    .limit(1);

  const [receiverProfile] = await db
    .select({ avatarUrl: userProfilesTable.avatarUrl })
    .from(userProfilesTable)
    .where(eq(userProfilesTable.userId, req.receiverId))
    .limit(1);

  return {
    ...req,
    senderName: sender?.name ?? null,
    senderEmail: null,
    senderAvatar: senderProfile?.avatarUrl ?? null,
    receiverName: receiver?.name ?? null,
    receiverEmail: null,
    receiverAvatar: receiverProfile?.avatarUrl ?? null,
  };
}

/**
 * POST /chat-requests
 * Send a new chat request. If a relationship row already exists (pending or accepted),
 * return it with an appropriate status code rather than inserting a duplicate.
 * The DB unique index on (sender_id, receiver_id) provides concurrency safety.
 */
router.post("/", requireAuth, async (req: AuthRequest, res) => {
  const result = createRequestSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: "Validation error", message: result.error.message });
    return;
  }

  const { receiverId } = result.data;
  const senderId = req.user!.id;

  if (receiverId === senderId) {
    res.status(400).json({ error: "Cannot send a chat request to yourself" });
    return;
  }

  try {
    const [existing] = await db
      .select()
      .from(chatRequestsTable)
      .where(
        or(
          and(
            eq(chatRequestsTable.senderId, senderId),
            eq(chatRequestsTable.receiverId, receiverId)
          ),
          and(
            eq(chatRequestsTable.senderId, receiverId),
            eq(chatRequestsTable.receiverId, senderId)
          )
        )
      )
      .limit(1);

    if (existing) {
      if (existing.status === "accepted") {
        res.status(409).json({ error: "Already connected", status: "accepted" });
        return;
      }
      if (existing.status === "pending") {
        const enriched = await enrichRequest(existing);
        res.status(200).json(serializeRequest(enriched));
        return;
      }
    }

    const [created] = await db
      .insert(chatRequestsTable)
      .values({ senderId, receiverId })
      .returning();

    const enriched = await enrichRequest(created);
    res.status(201).json(serializeRequest(enriched));
  } catch (err: unknown) {
    const pgErr = err as { code?: string };
    if (pgErr?.code === PG_UNIQUE_VIOLATION) {
      res.status(409).json({ error: "A chat request already exists between these users" });
      return;
    }
    req.log.error({ err }, "Create chat request error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/incoming", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  try {
    const rows = await db
      .select()
      .from(chatRequestsTable)
      .where(
        and(
          eq(chatRequestsTable.receiverId, userId),
          eq(chatRequestsTable.status, "pending")
        )
      );

    const enriched = await Promise.all(rows.map(enrichRequest));
    res.json(enriched.map(serializeRequest));
  } catch (err) {
    req.log.error({ err }, "Get incoming chat requests error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/outgoing", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  try {
    const rows = await db
      .select()
      .from(chatRequestsTable)
      .where(
        and(
          eq(chatRequestsTable.senderId, userId),
          eq(chatRequestsTable.status, "pending")
        )
      );

    const enriched = await Promise.all(rows.map(enrichRequest));
    res.json(enriched.map(serializeRequest));
  } catch (err) {
    req.log.error({ err }, "Get outgoing chat requests error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/between/:otherId", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const otherId = parseInt(req.params.otherId);
  if (isNaN(otherId)) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }

  try {
    const [row] = await db
      .select()
      .from(chatRequestsTable)
      .where(
        or(
          and(
            eq(chatRequestsTable.senderId, userId),
            eq(chatRequestsTable.receiverId, otherId)
          ),
          and(
            eq(chatRequestsTable.senderId, otherId),
            eq(chatRequestsTable.receiverId, userId)
          )
        )
      )
      .limit(1);

    if (!row) {
      res.json(null);
      return;
    }

    const enriched = await enrichRequest(row);
    res.json(serializeRequest(enriched));
  } catch (err) {
    req.log.error({ err }, "Get chat request between users error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/:id/accept", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const userId = req.user!.id;

  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid request ID" });
    return;
  }

  try {
    const [existing] = await db
      .select()
      .from(chatRequestsTable)
      .where(eq(chatRequestsTable.id, id))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "Chat request not found" });
      return;
    }

    if (existing.receiverId !== userId) {
      res.status(403).json({ error: "Only the receiver can accept this request" });
      return;
    }

    if (existing.status !== "pending") {
      res.status(400).json({ error: "Request is not pending" });
      return;
    }

    const [updated] = await db
      .update(chatRequestsTable)
      .set({ status: "accepted", updatedAt: new Date() })
      .where(eq(chatRequestsTable.id, id))
      .returning();

    const enriched = await enrichRequest(updated);
    res.json(serializeRequest(enriched));
  } catch (err) {
    req.log.error({ err }, "Accept chat request error");
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * PATCH /chat-requests/:id/decline
 * Hard-deletes the row after declining so the sender can re-request in the future.
 */
router.patch("/:id/decline", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const userId = req.user!.id;

  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid request ID" });
    return;
  }

  try {
    const [existing] = await db
      .select()
      .from(chatRequestsTable)
      .where(eq(chatRequestsTable.id, id))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "Chat request not found" });
      return;
    }

    if (existing.receiverId !== userId) {
      res.status(403).json({ error: "Only the receiver can decline this request" });
      return;
    }

    if (existing.status !== "pending") {
      res.status(400).json({ error: "Request is not pending" });
      return;
    }

    await db.delete(chatRequestsTable).where(eq(chatRequestsTable.id, id));
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Decline chat request error");
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * PATCH /chat-requests/:id/cancel
 * Hard-deletes the row after cancelling so the receiver can still be re-requested.
 */
router.patch("/:id/cancel", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const userId = req.user!.id;

  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid request ID" });
    return;
  }

  try {
    const [existing] = await db
      .select()
      .from(chatRequestsTable)
      .where(eq(chatRequestsTable.id, id))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "Chat request not found" });
      return;
    }

    if (existing.senderId !== userId) {
      res.status(403).json({ error: "Only the sender can cancel this request" });
      return;
    }

    if (existing.status !== "pending") {
      res.status(400).json({ error: "Only pending requests can be cancelled" });
      return;
    }

    await db.delete(chatRequestsTable).where(eq(chatRequestsTable.id, id));
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Cancel chat request error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
