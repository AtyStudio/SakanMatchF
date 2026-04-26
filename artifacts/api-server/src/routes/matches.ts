import { Router } from "express";
import { db, userProfilesTable, userPreferencesTable, usersTable } from "@workspace/db";
import { eq, ne } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { computeMatchScore, type MatchScoreBreakdown } from "../services/matching";

const router = Router();

interface MatchResult {
  userId: number;
  name: string | null;
  email: string;
  profile: {
    fullName: string | null;
    age: number | null;
    gender: string | null;
    occupation: string | null;
    cleanlinessLevel: string | null;
    sleepSchedule: string | null;
    noiseTolerance: string | null;
    guestPreference: string | null;
    petPreference: string | null;
    bio: string | null;
    moveInDate: string | null;
    avatarUrl: string | null;
  };
  preferences: {
    city: string | null;
    budgetMin: string | null;
    budgetMax: string | null;
    lifestyle: string | null;
    smoking: string | null;
    genderPref: string | null;
  };
  score: number;
  scoreBreakdown: MatchScoreBreakdown;
  matchReasons: string[];
}

router.get("/people", requireAuth, async (req: AuthRequest, res) => {
  try {
    const currentUserId = req.user!.id;

    const [currentProfile] = await db
      .select()
      .from(userProfilesTable)
      .where(eq(userProfilesTable.userId, currentUserId))
      .limit(1);

    const [currentPrefs] = await db
      .select()
      .from(userPreferencesTable)
      .where(eq(userPreferencesTable.userId, currentUserId))
      .limit(1);

    const otherProfiles = await db
      .select()
      .from(userProfilesTable)
      .where(ne(userProfilesTable.userId, currentUserId));

    if (otherProfiles.length === 0) {
      res.json([]);
      return;
    }

    const userIdsWithProfiles = otherProfiles.map(p => p.userId);

    const otherUsers = await db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
      })
      .from(usersTable)
      .where(ne(usersTable.id, currentUserId));

    const otherUserMap = new Map(otherUsers.map(u => [u.id, u]));

    const otherPrefsAll = await db
      .select()
      .from(userPreferencesTable)
      .where(ne(userPreferencesTable.userId, currentUserId));

    const profileMap = new Map(otherProfiles.map(p => [p.userId, p]));
    const prefsMap = new Map(otherPrefsAll.map(p => [p.userId, p]));

    const currentGenderPref = currentPrefs?.genderPref || "any";
    const currentGender = currentProfile?.gender || null;

    const matches: MatchResult[] = [];

    for (const userId of userIdsWithProfiles) {
      const otherUser = otherUserMap.get(userId);
      if (!otherUser) continue;

      const otherProfile = profileMap.get(otherUser.id) || null;
      const otherPrefs = prefsMap.get(otherUser.id) || null;

      const otherGender = otherProfile?.gender || null;
      const otherGenderPref = otherPrefs?.genderPref || "any";

      if (currentGenderPref !== "any" && otherGender && otherGender !== currentGenderPref) {
        continue;
      }
      if (otherGenderPref !== "any" && currentGender && currentGender !== otherGenderPref) {
        continue;
      }

      const { score, breakdown, matchReasons } = computeMatchScore(
        currentProfile || null,
        currentPrefs || null,
        otherProfile,
        otherPrefs,
      );

      matches.push({
        userId: otherUser.id,
        name: otherUser.name,
        email: otherUser.email,
        profile: {
          fullName: otherProfile?.fullName ?? null,
          age: otherProfile?.age ?? null,
          gender: otherProfile?.gender ?? null,
          occupation: otherProfile?.occupation ?? null,
          cleanlinessLevel: otherProfile?.cleanlinessLevel ?? null,
          sleepSchedule: otherProfile?.sleepSchedule ?? null,
          noiseTolerance: otherProfile?.noiseTolerance ?? null,
          guestPreference: otherProfile?.guestPreference ?? null,
          petPreference: otherProfile?.petPreference ?? null,
          bio: otherProfile?.bio ?? null,
          moveInDate: otherProfile?.moveInDate ?? null,
          avatarUrl: otherProfile?.avatarUrl ?? null,
        },
        preferences: {
          city: otherPrefs?.city ?? null,
          budgetMin: otherPrefs?.budgetMin ?? null,
          budgetMax: otherPrefs?.budgetMax ?? null,
          lifestyle: otherPrefs?.lifestyle ?? null,
          smoking: otherPrefs?.smoking ?? null,
          genderPref: otherPrefs?.genderPref ?? null,
        },
        score,
        scoreBreakdown: breakdown,
        matchReasons,
      });
    }

    matches.sort((a, b) => b.score - a.score);

    const city = req.query.city as string | undefined;
    const lifestyle = req.query.lifestyle as string | undefined;

    let filtered = matches;
    if (city) {
      filtered = filtered.filter(m => m.preferences.city?.toLowerCase() === city.toLowerCase());
    }
    if (lifestyle) {
      filtered = filtered.filter(m => m.preferences.lifestyle === lifestyle);
    }

    res.json(filtered);
  } catch (err) {
    req.log.error({ err }, "People matches error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
