import { Router } from "express";
import { db, messagesTable, usersTable, chatRequestsTable, listingsTable } from "@workspace/db";
import { eq, and, or, desc, sql } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, type AuthRequest } from "../middlewares/auth";

const router = Router();

const sendMessageSchema = z.object({
  receiverId: z.number().int().positive(),
  listingId: z.number().int().positive().optional(),
  body: z.string().min(1).max(2000),
});

interface MessageRow {
  id: number;
  senderId: number;
  receiverId: number;
  listingId: number | null;
  body: string;
  read: boolean;
  createdAt: Date;
}

function serializeMessage(msg: MessageRow) {
  return {
    id: msg.id,
    senderId: msg.senderId,
    receiverId: msg.receiverId,
    listingId: msg.listingId ?? null,
    body: msg.body,
    read: msg.read,
    createdAt: msg.createdAt.toISOString(),
  };
}

router.get("/conversations", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;

    const msgs = await db
      .select({
        id: messagesTable.id,
        senderId: messagesTable.senderId,
        receiverId: messagesTable.receiverId,
        listingId: messagesTable.listingId,
        body: messagesTable.body,
        read: messagesTable.read,
        createdAt: messagesTable.createdAt,
      })
      .from(messagesTable)
      .where(
        or(
          eq(messagesTable.senderId, userId),
          eq(messagesTable.receiverId, userId)
        )
      )
      .orderBy(desc(messagesTable.createdAt));

    const conversationMap = new Map<number, MessageRow>();
    for (const msg of msgs) {
      const otherId = msg.senderId === userId ? msg.receiverId : msg.senderId;
      if (!conversationMap.has(otherId)) {
        conversationMap.set(otherId, msg);
      }
    }

    const conversations = await Promise.all(
      Array.from(conversationMap.entries()).map(async ([otherId, lastMsg]) => {
        const [otherUser] = await db
          .select({ id: usersTable.id, email: usersTable.email, name: usersTable.name })
          .from(usersTable)
          .where(eq(usersTable.id, otherId))
          .limit(1);

        const unreadCount = msgs.filter(
          m => m.senderId === otherId && m.receiverId === userId && !m.read
        ).length;

        return {
          otherId,
          otherEmail: otherUser?.email ?? null,
          otherName: otherUser?.name ?? null,
          lastMessage: lastMsg.body,
          lastMessageAt: lastMsg.createdAt.toISOString(),
          unreadCount,
        };
      })
    );

    res.json(conversations);
  } catch (err) {
    req.log.error({ err }, "Get conversations error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/thread/:otherId", requireAuth, async (req: AuthRequest, res) => {
  const otherId = parseInt(req.params.otherId);
  if (isNaN(otherId)) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }

  try {
    const userId = req.user!.id;

    const rows = await db
      .select({
        id: messagesTable.id,
        senderId: messagesTable.senderId,
        receiverId: messagesTable.receiverId,
        listingId: messagesTable.listingId,
        body: messagesTable.body,
        read: messagesTable.read,
        createdAt: messagesTable.createdAt,
      })
      .from(messagesTable)
      .where(
        or(
          and(eq(messagesTable.senderId, userId), eq(messagesTable.receiverId, otherId)),
          and(eq(messagesTable.senderId, otherId), eq(messagesTable.receiverId, userId))
        )
      )
      .orderBy(messagesTable.createdAt);

    await db
      .update(messagesTable)
      .set({ read: true })
      .where(
        and(
          eq(messagesTable.senderId, otherId),
          eq(messagesTable.receiverId, userId),
          eq(messagesTable.read, false)
        )
      );

    res.json(rows.map(serializeMessage));
  } catch (err) {
    req.log.error({ err }, "Get thread error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", requireAuth, async (req: AuthRequest, res) => {
  const result = sendMessageSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: "Validation error", message: result.error.message });
    return;
  }

  const { receiverId, listingId, body } = result.data;
  const senderId = req.user!.id;

  if (receiverId === senderId) {
    res.status(400).json({ error: "Cannot message yourself" });
    return;
  }

  try {
    const [existingReq] = await db
      .select({ id: chatRequestsTable.id, status: chatRequestsTable.status })
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

    let isAuthorized = existingReq?.status === "accepted";

    if (!isAuthorized) {
      let listingOwnerMatches = false;
      if (listingId) {
        const [listing] = await db
          .select({ ownerId: listingsTable.ownerId })
          .from(listingsTable)
          .where(eq(listingsTable.id, listingId))
          .limit(1);
        listingOwnerMatches = !!listing && listing.ownerId === receiverId;
      }

      const otherSentMessage = !listingOwnerMatches
        ? await (async () => {
            const [m] = await db
              .select({ id: messagesTable.id })
              .from(messagesTable)
              .where(
                and(
                  eq(messagesTable.senderId, receiverId),
                  eq(messagesTable.receiverId, senderId)
                )
              )
              .limit(1);
            return !!m;
          })()
        : false;

      if (listingOwnerMatches || otherSentMessage) {
        if (existingReq) {
          if (existingReq.status !== "accepted") {
            await db
              .update(chatRequestsTable)
              .set({ status: "accepted", updatedAt: new Date() })
              .where(eq(chatRequestsTable.id, existingReq.id));
          }
        } else {
          try {
            await db
              .insert(chatRequestsTable)
              .values({ senderId, receiverId, status: "accepted" });
          } catch (e: unknown) {
            const pgErr = e as { code?: string };
            if (pgErr?.code !== "23505") throw e;
            await db
              .update(chatRequestsTable)
              .set({ status: "accepted", updatedAt: new Date() })
              .where(
                and(
                  eq(
                    sql`LEAST(${chatRequestsTable.senderId}, ${chatRequestsTable.receiverId})`,
                    Math.min(senderId, receiverId)
                  ),
                  eq(
                    sql`GREATEST(${chatRequestsTable.senderId}, ${chatRequestsTable.receiverId})`,
                    Math.max(senderId, receiverId)
                  )
                )
              );
          }
        }
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      res.status(403).json({ error: "Chat request required", message: "You need an accepted chat request to message this user" });
      return;
    }

    const [msg] = await db
      .insert(messagesTable)
      .values({
        senderId,
        receiverId,
        listingId: listingId ?? null,
        body,
      })
      .returning();

    res.status(201).json(serializeMessage(msg));
  } catch (err) {
    req.log.error({ err }, "Send message error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
