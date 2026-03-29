import { Router } from "express";
import { db, favoritesTable, listingsTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth";

const router = Router();

function formatListing(listing: typeof listingsTable.$inferSelect & { ownerEmail?: string; ownerName?: string | null }) {
  return {
    id: listing.id,
    title: listing.title,
    description: listing.description ?? null,
    price: parseFloat(listing.price as string),
    city: listing.city,
    images: listing.images ?? [],
    ownerId: listing.ownerId,
    ownerEmail: listing.ownerEmail ?? undefined,
    ownerName: listing.ownerName ?? null,
    createdAt: listing.createdAt.toISOString(),
  };
}

router.get("/", requireAuth, async (req: AuthRequest, res) => {
  if (req.user!.role !== "seeker") {
    res.status(403).json({ error: "Only seekers can have favorites" });
    return;
  }
  try {
    const rows = await db
      .select({
        favoriteId: favoritesTable.id,
        id: listingsTable.id,
        title: listingsTable.title,
        description: listingsTable.description,
        price: listingsTable.price,
        city: listingsTable.city,
        images: listingsTable.images,
        ownerId: listingsTable.ownerId,
        ownerEmail: usersTable.email,
        ownerName: usersTable.name,
        createdAt: listingsTable.createdAt,
      })
      .from(favoritesTable)
      .innerJoin(listingsTable, eq(favoritesTable.listingId, listingsTable.id))
      .leftJoin(usersTable, eq(listingsTable.ownerId, usersTable.id))
      .where(eq(favoritesTable.userId, req.user!.id));

    res.json(rows.map(formatListing));
  } catch (err) {
    req.log.error({ err }, "Get favorites error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:listingId", requireAuth, async (req: AuthRequest, res) => {
  if (req.user!.role !== "seeker") {
    res.status(403).json({ error: "Only seekers can favorite listings" });
    return;
  }
  const listingId = parseInt(req.params.listingId);
  if (isNaN(listingId)) {
    res.status(400).json({ error: "Invalid listing ID" });
    return;
  }

  try {
    const existing = await db
      .select({ id: favoritesTable.id })
      .from(favoritesTable)
      .where(and(
        eq(favoritesTable.userId, req.user!.id),
        eq(favoritesTable.listingId, listingId)
      ))
      .limit(1);

    if (existing.length > 0) {
      res.status(409).json({ error: "Already favorited" });
      return;
    }

    const [fav] = await db
      .insert(favoritesTable)
      .values({ userId: req.user!.id, listingId })
      .returning();

    res.status(201).json(fav);
  } catch (err) {
    req.log.error({ err }, "Add favorite error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:listingId", requireAuth, async (req: AuthRequest, res) => {
  if (req.user!.role !== "seeker") {
    res.status(403).json({ error: "Only seekers can remove favorites" });
    return;
  }
  const listingId = parseInt(req.params.listingId);
  if (isNaN(listingId)) {
    res.status(400).json({ error: "Invalid listing ID" });
    return;
  }

  try {
    await db
      .delete(favoritesTable)
      .where(and(
        eq(favoritesTable.userId, req.user!.id),
        eq(favoritesTable.listingId, listingId)
      ));

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Remove favorite error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/ids", requireAuth, async (req: AuthRequest, res) => {
  if (req.user!.role !== "seeker") {
    res.json([]);
    return;
  }
  try {
    const rows = await db
      .select({ listingId: favoritesTable.listingId })
      .from(favoritesTable)
      .where(eq(favoritesTable.userId, req.user!.id));

    res.json(rows.map(r => r.listingId));
  } catch (err) {
    req.log.error({ err }, "Get favorite IDs error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
