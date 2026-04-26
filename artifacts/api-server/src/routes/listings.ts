import { Router } from "express";
import { db, listingsTable, usersTable, requestsTable, listingReportsTable, userPreferencesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { getTableColumns } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, requireOwner, optionalAuth, type AuthRequest } from "../middlewares/auth";
import {
  computeListingMatchScore,
  hasUsefulPreferences,
  type ListingMatchBreakdown,
} from "../services/matching";

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
  propertyType: z.enum(["room", "studio", "apartment", "villa"]).optional(),
  bedrooms: z.number().int().min(0).optional(),
  bathrooms: z.number().int().min(0).optional(),
  area: z.number().positive().optional(),
  floor: z.number().int().optional(),
  isFurnished: z.boolean().optional(),
  neighborhood: z.string().optional(),
  amenities: z.array(z.string()).optional().default([]),
  deposit: z.number().min(0).optional(),
  billsIncluded: z.boolean().optional(),
  agencyFees: z.number().min(0).optional(),
  availableFrom: z.string().optional(),
  smokingAllowed: z.boolean().optional(),
  petsAllowed: z.boolean().optional(),
  guestsAllowed: z.boolean().optional(),
  genderPreference: z.enum(["any", "male", "female"]).optional(),
  quietHours: z.string().optional(),
  minStay: z.number().int().min(1).optional(),
  maxStay: z.number().int().min(1).optional(),
  roommateNote: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  address: z.string().optional(),
});

type ListingRow = typeof listingsTable.$inferSelect & {
  ownerEmail?: string;
  ownerName?: string | null;
  ownerIsPremium?: boolean;
  ownerCreatedAt?: Date | null;
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
    ownerCreatedAt: listing.ownerCreatedAt ? listing.ownerCreatedAt.toISOString() : null,
    isFeatured: listing.ownerIsPremium ?? false,
    viewCount: showAnalytics ? (listing.viewCount ?? 0) : null,
    contactClickCount: showAnalytics ? (listing.contactClickCount ?? 0) : null,
    requestCount: showAnalytics ? (listing.requestCount ?? 0) : null,
    createdAt: listing.createdAt.toISOString(),
    propertyType: listing.propertyType ?? null,
    bedrooms: listing.bedrooms ?? null,
    bathrooms: listing.bathrooms ?? null,
    area: listing.area != null ? parseFloat(listing.area as string) : null,
    floor: listing.floor ?? null,
    isFurnished: listing.isFurnished ?? null,
    neighborhood: listing.neighborhood ?? null,
    amenities: listing.amenities ?? [],
    deposit: listing.deposit != null ? parseFloat(listing.deposit as string) : null,
    billsIncluded: listing.billsIncluded ?? null,
    agencyFees: listing.agencyFees != null ? parseFloat(listing.agencyFees as string) : null,
    availableFrom: listing.availableFrom ?? null,
    smokingAllowed: listing.smokingAllowed ?? null,
    petsAllowed: listing.petsAllowed ?? null,
    guestsAllowed: listing.guestsAllowed ?? null,
    genderPreference: listing.genderPreference ?? null,
    quietHours: listing.quietHours ?? null,
    minStay: listing.minStay ?? null,
    maxStay: listing.maxStay ?? null,
    roommateNote: listing.roommateNote ?? null,
    latitude: listing.latitude != null ? parseFloat(listing.latitude as string) : null,
    longitude: listing.longitude != null ? parseFloat(listing.longitude as string) : null,
    address: listing.address ?? null,
  };
}

const listingCols = getTableColumns(listingsTable);

router.get("/", async (req, res) => {
  try {
    const city = req.query.city as string | undefined;
    const minPrice = req.query.minPrice ? parseFloat(req.query.minPrice as string) : undefined;
    const maxPrice = req.query.maxPrice ? parseFloat(req.query.maxPrice as string) : undefined;

    const rows = await db
      .select({
        ...listingCols,
        ownerEmail: usersTable.email,
        ownerName: usersTable.name,
        ownerIsPremium: usersTable.isPremium,
        ownerCreatedAt: usersTable.createdAt,
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

    res.json(results.map(r => formatListing(r)));
  } catch (err) {
    req.log.error({ err }, "Get listings error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/my", requireAuth, async (req: AuthRequest, res) => {
  try {
    const rows = await db
      .select({
        ...listingCols,
        ownerEmail: usersTable.email,
        ownerName: usersTable.name,
        ownerIsPremium: usersTable.isPremium,
        ownerCreatedAt: usersTable.createdAt,
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

interface ListingMatchEntry {
  listing: ReturnType<typeof formatListing>;
  score: number | null;
  breakdown: ListingMatchBreakdown | null;
  matchReasons: string[];
}

interface ListingMatchesResponse {
  hasPreferences: boolean;
  matches: ListingMatchEntry[];
}

async function loadListingsWithOwner(filter?: { id?: number }) {
  const query = db
    .select({
      ...listingCols,
      ownerEmail: usersTable.email,
      ownerName: usersTable.name,
      ownerIsPremium: usersTable.isPremium,
      ownerCreatedAt: usersTable.createdAt,
    })
    .from(listingsTable)
    .leftJoin(usersTable, eq(listingsTable.ownerId, usersTable.id));

  if (filter?.id !== undefined) {
    return query.where(eq(listingsTable.id, filter.id));
  }
  return query.orderBy(sql`${usersTable.isPremium} DESC NULLS LAST, ${listingsTable.createdAt} DESC`);
}

router.get("/matches", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;

    const [prefs] = await db
      .select()
      .from(userPreferencesTable)
      .where(eq(userPreferencesTable.userId, userId))
      .limit(1);

    const rows = (await loadListingsWithOwner()) as ListingRow[];
    const hasPrefs = hasUsefulPreferences(prefs ?? null);

    const matches: ListingMatchEntry[] = rows.map(row => {
      const listing = formatListing(row);
      if (!hasPrefs) {
        return { listing, score: null, breakdown: null, matchReasons: [] };
      }
      const result = computeListingMatchScore(prefs ?? null, row);
      return {
        listing,
        score: result.score,
        breakdown: result.breakdown,
        matchReasons: result.matchReasons,
      };
    });

    if (hasPrefs) {
      matches.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    }

    const response: ListingMatchesResponse = {
      hasPreferences: hasPrefs,
      matches,
    };
    res.json(response);
  } catch (err) {
    req.log.error({ err }, "Listing matches error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id/match", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid listing ID" });
    return;
  }

  try {
    const [row] = (await loadListingsWithOwner({ id })) as ListingRow[];
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const [prefs] = await db
      .select()
      .from(userPreferencesTable)
      .where(eq(userPreferencesTable.userId, req.user!.id))
      .limit(1);

    const listing = formatListing(row);
    const hasPrefs = hasUsefulPreferences(prefs ?? null);

    if (!hasPrefs) {
      const empty: ListingMatchEntry = {
        listing,
        score: null,
        breakdown: null,
        matchReasons: [],
      };
      res.json({ hasPreferences: false, ...empty });
      return;
    }

    const result = computeListingMatchScore(prefs ?? null, row);
    const entry: ListingMatchEntry = {
      listing,
      score: result.score,
      breakdown: result.breakdown,
      matchReasons: result.matchReasons,
    };
    res.json({ hasPreferences: true, ...entry });
  } catch (err) {
    req.log.error({ err }, "Listing match error");
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
        ...listingCols,
        ownerEmail: usersTable.email,
        ownerName: usersTable.name,
        ownerIsPremium: usersTable.isPremium,
        ownerCreatedAt: usersTable.createdAt,
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

router.post("/:id/report", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid listing ID" });
    return;
  }

  const result = z.object({ reason: z.string().min(1) }).safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: "Validation error" });
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

    await db.insert(listingReportsTable).values({
      listingId: id,
      reporterId: req.user!.id,
      reason: result.data.reason,
    });

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Report listing error");
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

    if (!user.isPremium) {
      const premiumFieldsUsed = [
        result.data.deposit != null,
        result.data.agencyFees != null,
        result.data.billsIncluded != null,
        result.data.availableFrom != null,
        result.data.roommateNote != null,
        result.data.latitude != null,
        result.data.longitude != null,
      ].some(Boolean);

      if (premiumFieldsUsed) {
        res.status(403).json({
          error: "Upgrade required",
          code: "upgrade_required",
          message: "Financial details, roommate preferences, and exact location require a Premium subscription.",
        });
        return;
      }
    }

    const data = result.data;
    const [listing] = await db
      .insert(listingsTable)
      .values({
        title: data.title,
        description: data.description ?? null,
        price: data.price.toString(),
        city: data.city,
        images: data.images,
        ownerId: user.id,
        propertyType: data.propertyType ?? null,
        bedrooms: data.bedrooms ?? null,
        bathrooms: data.bathrooms ?? null,
        area: data.area?.toString() ?? null,
        floor: data.floor ?? null,
        isFurnished: data.isFurnished ?? null,
        neighborhood: data.neighborhood ?? null,
        address: data.address ?? null,
        amenities: data.amenities ?? [],
        deposit: data.deposit?.toString() ?? null,
        billsIncluded: data.billsIncluded ?? null,
        agencyFees: data.agencyFees?.toString() ?? null,
        availableFrom: data.availableFrom ?? null,
        smokingAllowed: data.smokingAllowed ?? null,
        petsAllowed: data.petsAllowed ?? null,
        guestsAllowed: data.guestsAllowed ?? null,
        genderPreference: data.genderPreference ?? null,
        quietHours: data.quietHours ?? null,
        minStay: data.minStay ?? null,
        maxStay: data.maxStay ?? null,
        roommateNote: data.roommateNote ?? null,
        latitude: data.latitude?.toString() ?? null,
        longitude: data.longitude?.toString() ?? null,
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
