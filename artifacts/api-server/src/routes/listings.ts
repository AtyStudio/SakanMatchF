import { Router } from "express";
import { db, listingsTable, usersTable, requestsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, requireOwner, optionalAuth, type AuthRequest } from "../middlewares/auth";

const router = Router();

const FREE_LISTING_LIMIT = 1;
const FREE_IMAGE_LIMIT = 4;
const PREMIUM_IMAGE_LIMIT = 10;

const createListingSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  price: z.number().positive(),
  city: z.string().min(1),
  images: z.array(z.string()).optional().default([]),
});

type ListingRow = typeof listingsTable.$inferSelect & {
  ownerEmail?: string;
  ownerName?: string | null;
  ownerIsPremium?: boolean;
  requestCount?: number;
};

function formatListing(listing: ListingRow, showAnalytics = false) {
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
    isFeatured: listing.ownerIsPremium ?? false,
    viewCount: showAnalytics ? (listing.viewCount ?? 0) : null,
    contactClickCount: showAnalytics ? (listing.contactClickCount ?? 0) : null,
    requestCount: showAnalytics ? (listing.requestCount ?? 0) : null,
    createdAt: listing.createdAt.toISOString(),
  };
}

router.get("/", async (req, res) => {
  try {
    const city = req.query.city as string | undefined;
    const minPrice = req.query.minPrice ? parseFloat(req.query.minPrice as string) : undefined;
    const maxPrice = req.query.maxPrice ? parseFloat(req.query.maxPrice as string) : undefined;

    const rows = await db
      .select({
        id: listingsTable.id,
        title: listingsTable.title,
        description: listingsTable.description,
        price: listingsTable.price,
        city: listingsTable.city,
        images: listingsTable.images,
        ownerId: listingsTable.ownerId,
        ownerEmail: usersTable.email,
        ownerName: usersTable.name,
        ownerIsPremium: usersTable.isPremium,
        viewCount: listingsTable.viewCount,
        contactClickCount: listingsTable.contactClickCount,
        createdAt: listingsTable.createdAt,
      })
      .from(listingsTable)
      .leftJoin(usersTable, eq(listingsTable.ownerId, usersTable.id))
      .orderBy(sql`${usersTable.isPremium} DESC NULLS LAST, ${listingsTable.createdAt} DESC`);

    let results = rows as ListingRow[];

    if (city) {
      results = results.filter((r) => r.city.toLowerCase().includes(city.toLowerCase()));
    }
    if (minPrice !== undefined) {
      results = results.filter((r) => parseFloat(r.price as string) >= minPrice);
    }
    if (maxPrice !== undefined) {
      results = results.filter((r) => parseFloat(r.price as string) <= maxPrice);
    }

    res.json(results.map(formatListing));
  } catch (err) {
    req.log.error({ err }, "Get listings error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/my", requireAuth, async (req: AuthRequest, res) => {
  try {
    const rows = await db
      .select({
        id: listingsTable.id,
        title: listingsTable.title,
        description: listingsTable.description,
        price: listingsTable.price,
        city: listingsTable.city,
        images: listingsTable.images,
        ownerId: listingsTable.ownerId,
        ownerEmail: usersTable.email,
        ownerName: usersTable.name,
        ownerIsPremium: usersTable.isPremium,
        viewCount: listingsTable.viewCount,
        contactClickCount: listingsTable.contactClickCount,
        createdAt: listingsTable.createdAt,
      })
      .from(listingsTable)
      .leftJoin(usersTable, eq(listingsTable.ownerId, usersTable.id))
      .where(eq(listingsTable.ownerId, req.user!.id))
      .orderBy(listingsTable.createdAt);

    const listingIds = rows.map(r => r.id);

    let requestCounts: Record<number, number> = {};
    if (listingIds.length > 0) {
      const counts = await db
        .select({
          listingId: requestsTable.listingId,
          count: sql<number>`count(*)::int`,
        })
        .from(requestsTable)
        .where(sql`${requestsTable.listingId} = ANY(ARRAY[${sql.join(listingIds.map(id => sql`${id}`), sql`, `)}]::int[])`)
        .groupBy(requestsTable.listingId);

      for (const c of counts) {
        requestCounts[c.listingId] = c.count;
      }
    }

    const rowsWithCounts = (rows as ListingRow[]).map(r => ({
      ...r,
      requestCount: requestCounts[r.id] ?? 0,
    }));

    const showAnalytics = req.user!.isPremium;
    res.json(rowsWithCounts.map(r => formatListing(r, showAnalytics)));
  } catch (err) {
    req.log.error({ err }, "Get my listings error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", optionalAuth, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid listing ID" });
    return;
  }

  try {
    const [row] = await db
      .select({
        id: listingsTable.id,
        title: listingsTable.title,
        description: listingsTable.description,
        price: listingsTable.price,
        city: listingsTable.city,
        images: listingsTable.images,
        ownerId: listingsTable.ownerId,
        ownerEmail: usersTable.email,
        ownerName: usersTable.name,
        ownerIsPremium: usersTable.isPremium,
        viewCount: listingsTable.viewCount,
        contactClickCount: listingsTable.contactClickCount,
        createdAt: listingsTable.createdAt,
      })
      .from(listingsTable)
      .leftJoin(usersTable, eq(listingsTable.ownerId, usersTable.id))
      .where(eq(listingsTable.id, id))
      .limit(1);

    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const viewerUserId = req.user?.id ?? null;

    const [{ count: requestCount }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(requestsTable)
      .where(eq(requestsTable.listingId, id));

    const isOwner = viewerUserId === row.ownerId;
    const ownerIsPremium = (row as ListingRow).ownerIsPremium ?? false;
    const showAnalytics = isOwner && ownerIsPremium;

    res.json(formatListing({ ...row as ListingRow, requestCount }, showAnalytics));
  } catch (err) {
    req.log.error({ err }, "Get listing error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:id/view", optionalAuth, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid listing ID" });
    return;
  }

  try {
    const [existing] = await db
      .select({ id: listingsTable.id, ownerId: listingsTable.ownerId })
      .from(listingsTable)
      .where(eq(listingsTable.id, id))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const viewerUserId = req.user?.id ?? null;
    if (viewerUserId !== existing.ownerId) {
      await db
        .update(listingsTable)
        .set({ viewCount: sql`${listingsTable.viewCount} + 1` })
        .where(eq(listingsTable.id, id));
    }

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "View count error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:id/contact-click", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid listing ID" });
    return;
  }

  try {
    const [existing] = await db
      .select({ id: listingsTable.id })
      .from(listingsTable)
      .where(eq(listingsTable.id, id))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    await db
      .update(listingsTable)
      .set({ contactClickCount: sql`${listingsTable.contactClickCount} + 1` })
      .where(eq(listingsTable.id, id));

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Contact click error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", requireAuth, requireOwner, async (req: AuthRequest, res) => {
  const result = createListingSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: "Validation error", message: result.error.message });
    return;
  }

  const user = req.user!;

  try {
    if (!user.isPremium) {
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(listingsTable)
        .where(eq(listingsTable.ownerId, user.id));

      if (count >= FREE_LISTING_LIMIT) {
        res.status(403).json({
          error: "Upgrade required",
          code: "upgrade_required",
          message: `Free owners can only have ${FREE_LISTING_LIMIT} active listing. Upgrade to Premium for unlimited listings.`,
        });
        return;
      }
    }

    const imageLimit = user.isPremium ? PREMIUM_IMAGE_LIMIT : FREE_IMAGE_LIMIT;
    if (result.data.images.length > imageLimit) {
      res.status(403).json({
        error: "Image limit exceeded",
        code: "upgrade_required",
        message: `${user.isPremium ? "Premium" : "Free"} owners can upload up to ${imageLimit} images per listing.`,
      });
      return;
    }

    const [listing] = await db
      .insert(listingsTable)
      .values({
        title: result.data.title,
        description: result.data.description ?? null,
        price: result.data.price.toString(),
        city: result.data.city,
        images: result.data.images,
        ownerId: user.id,
      })
      .returning();

    res.status(201).json(formatListing({ ...listing, ownerIsPremium: user.isPremium }));
  } catch (err) {
    req.log.error({ err }, "Create listing error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid listing ID" });
    return;
  }

  try {
    const [existing] = await db
      .select({ id: listingsTable.id, ownerId: listingsTable.ownerId })
      .from(listingsTable)
      .where(eq(listingsTable.id, id))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    if (existing.ownerId !== req.user!.id) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    await db.delete(listingsTable).where(eq(listingsTable.id, id));
    res.json({ success: true, message: "Listing deleted" });
  } catch (err) {
    req.log.error({ err }, "Delete listing error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
