import { Router } from "express";
import { db, userProfilesTable, userPreferencesTable, usersTable } from "@workspace/db";
import { eq, ne, and, isNotNull } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, type AuthRequest } from "../middlewares/auth";

const router = Router();

const profileSchema = z.object({
  fullName: z.string().optional().nullable(),
  age: z.number().int().min(16).max(100).optional().nullable(),
  gender: z.enum(["male", "female", "other"]).optional().nullable(),
  occupation: z.string().optional().nullable(),
  cleanlinessLevel: z.enum(["very_clean", "clean", "moderate", "relaxed"]).optional().nullable(),
  sleepSchedule: z.enum(["early_bird", "night_owl", "flexible"]).optional().nullable(),
  noiseTolerance: z.enum(["quiet", "moderate", "loud"]).optional().nullable(),
  guestPreference: z.enum(["rarely", "sometimes", "often"]).optional().nullable(),
  petPreference: z.enum(["love_pets", "no_pets", "no_preference"]).optional().nullable(),
  bio: z.string().max(500).optional().nullable(),
  moveInDate: z.string().optional().nullable(),
  avatarUrl: z.string().url().optional().nullable(),
});

router.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const [profile] = await db
      .select()
      .from(userProfilesTable)
      .where(eq(userProfilesTable.userId, req.user!.id))
      .limit(1);

    const [prefs] = await db
      .select()
      .from(userPreferencesTable)
      .where(eq(userPreferencesTable.userId, req.user!.id))
      .limit(1);

    res.json({ profile: profile || null, preferences: prefs || null });
  } catch (err) {
    req.log.error({ err }, "Get profile error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/", requireAuth, async (req: AuthRequest, res) => {
  const result = profileSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: "Validation error", message: result.error.message });
    return;
  }

  const data = result.data;

  try {
    const existing = await db
      .select({ id: userProfilesTable.id })
      .from(userProfilesTable)
      .where(eq(userProfilesTable.userId, req.user!.id))
      .limit(1);

    const profileData = {
      fullName: data.fullName ?? null,
      age: data.age ?? null,
      gender: data.gender ?? null,
      occupation: data.occupation ?? null,
      cleanlinessLevel: data.cleanlinessLevel ?? null,
      sleepSchedule: data.sleepSchedule ?? null,
      noiseTolerance: data.noiseTolerance ?? null,
      guestPreference: data.guestPreference ?? null,
      petPreference: data.petPreference ?? null,
      bio: data.bio ?? null,
      moveInDate: data.moveInDate ?? null,
      avatarUrl: data.avatarUrl ?? null,
      updatedAt: new Date(),
    };

    if (existing.length > 0) {
      await db
        .update(userProfilesTable)
        .set(profileData)
        .where(eq(userProfilesTable.userId, req.user!.id));
    } else {
      await db
        .insert(userProfilesTable)
        .values({ userId: req.user!.id, ...profileData });
    }

    const [savedProfile] = await db
      .select()
      .from(userProfilesTable)
      .where(eq(userProfilesTable.userId, req.user!.id))
      .limit(1);

    const [savedPrefs] = await db
      .select()
      .from(userPreferencesTable)
      .where(eq(userPreferencesTable.userId, req.user!.id))
      .limit(1);

    res.json({ profile: savedProfile || null, preferences: savedPrefs || null });
  } catch (err) {
    req.log.error({ err }, "Update profile error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:userId", requireAuth, async (req: AuthRequest, res) => {
  const userId = parseInt(req.params.userId);
  if (isNaN(userId)) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }

  try {
    const [user] = await db
      .select({ id: usersTable.id, name: usersTable.name, email: usersTable.email, isPremium: usersTable.isPremium, role: usersTable.role })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const [profile] = await db
      .select()
      .from(userProfilesTable)
      .where(eq(userProfilesTable.userId, userId))
      .limit(1);

    const [prefs] = await db
      .select()
      .from(userPreferencesTable)
      .where(eq(userPreferencesTable.userId, userId))
      .limit(1);

    res.json({ user, profile: profile || null, preferences: prefs || null });
  } catch (err) {
    req.log.error({ err }, "Get public profile error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
