import { Router } from "express";
import { db, requestsTable, listingsTable, usersTable } from "@workspace/db";
import { eq, and, or } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, type AuthRequest } from "../middlewares/auth";

const router = Router();

const createRequestSchema = z.object({
  listingId: z.number().int().positive(),
  message: z.string().optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(["accepted", "declined"]),
});

interface RequestRow {
  id: number;
  seekerId: number;
  listingId: number;
  status: string;
  message: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  seekerEmail: string | null;
  seekerName: string | null;
  listingTitle: string | null;
  listingCity: string | null;
}

function formatRequest(row: RequestRow) {
  return {
    id: row.id,
    seekerId: row.seekerId,
    listingId: row.listingId,
    status: row.status,
    message: row.message ?? null,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
    seekerEmail: row.seekerEmail ?? null,
    seekerName: row.seekerName ?? null,
    listingTitle: row.listingTitle ?? null,
    listingCity: row.listingCity ?? null,
  };
}

router.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    let rows: RequestRow[];

    if (user.role === "seeker") {
      rows = await db
        .select({
          id: requestsTable.id,
          seekerId: requestsTable.seekerId,
          listingId: requestsTable.listingId,
          status: requestsTable.status,
          message: requestsTable.message,
          createdAt: requestsTable.createdAt,
          updatedAt: requestsTable.updatedAt,
          seekerEmail: usersTable.email,
          seekerName: usersTable.name,
          listingTitle: listingsTable.title,
          listingCity: listingsTable.city,
        })
        .from(requestsTable)
        .leftJoin(usersTable, eq(requestsTable.seekerId, usersTable.id))
        .leftJoin(listingsTable, eq(requestsTable.listingId, listingsTable.id))
        .where(eq(requestsTable.seekerId, user.id))
        .orderBy(requestsTable.createdAt);
    } else {
      const ownerListings = await db
        .select({ id: listingsTable.id })
        .from(listingsTable)
        .where(eq(listingsTable.ownerId, user.id));

      if (ownerListings.length === 0) {
        res.json([]);
        return;
      }

      const listingIds = ownerListings.map(l => l.id);

      rows = await db
        .select({
          id: requestsTable.id,
          seekerId: requestsTable.seekerId,
          listingId: requestsTable.listingId,
          status: requestsTable.status,
          message: requestsTable.message,
          createdAt: requestsTable.createdAt,
          updatedAt: requestsTable.updatedAt,
          seekerEmail: usersTable.email,
          seekerName: usersTable.name,
          listingTitle: listingsTable.title,
          listingCity: listingsTable.city,
        })
        .from(requestsTable)
        .leftJoin(usersTable, eq(requestsTable.seekerId, usersTable.id))
        .leftJoin(listingsTable, eq(requestsTable.listingId, listingsTable.id))
        .where(
          listingIds.length === 1
            ? eq(requestsTable.listingId, listingIds[0])
            : or(...listingIds.map(id => eq(requestsTable.listingId, id)))!
        )
        .orderBy(requestsTable.createdAt);
    }

    res.json(rows.map(formatRequest));
  } catch (err) {
    req.log.error({ err }, "Get requests error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", requireAuth, async (req: AuthRequest, res) => {
  if (req.user!.role !== "seeker") {
    res.status(403).json({ error: "Only seekers can send requests" });
    return;
  }

  const result = createRequestSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: "Validation error", message: result.error.message });
    return;
  }

  const { listingId, message } = result.data;

  try {
    const existing = await db
      .select({ id: requestsTable.id })
      .from(requestsTable)
      .where(and(
        eq(requestsTable.seekerId, req.user!.id),
        eq(requestsTable.listingId, listingId)
      ))
      .limit(1);

    if (existing.length > 0) {
      res.status(409).json({ error: "Request already sent" });
      return;
    }

    const [request] = await db
      .insert(requestsTable)
      .values({
        seekerId: req.user!.id,
        listingId,
        message: message ?? null,
      })
      .returning();

    res.status(201).json(formatRequest({
      ...request,
      seekerEmail: null,
      seekerName: null,
      listingTitle: null,
      listingCity: null,
    }));
  } catch (err) {
    req.log.error({ err }, "Create request error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/:id", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid request ID" });
    return;
  }

  const result = updateStatusSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: "Validation error", message: result.error.message });
    return;
  }

  try {
    const [request] = await db
      .select()
      .from(requestsTable)
      .where(eq(requestsTable.id, id))
      .limit(1);

    if (!request) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const listing = await db
      .select({ ownerId: listingsTable.ownerId })
      .from(listingsTable)
      .where(eq(listingsTable.id, request.listingId))
      .limit(1);

    if (!listing[0] || listing[0].ownerId !== req.user!.id) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const [updated] = await db
      .update(requestsTable)
      .set({ status: result.data.status, updatedAt: new Date() })
      .where(eq(requestsTable.id, id))
      .returning();

    res.json(formatRequest({
      ...updated,
      seekerEmail: null,
      seekerName: null,
      listingTitle: null,
      listingCity: null,
    }));
  } catch (err) {
    req.log.error({ err }, "Update request error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
