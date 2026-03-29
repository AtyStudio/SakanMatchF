import { Router } from "express";
import { db, userProfilesTable, userPreferencesTable, usersTable } from "@workspace/db";
import { eq, ne } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth";

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
  matchReasons: string[];
}

function computeScore(
  currentProfile: typeof userProfilesTable.$inferSelect | null,
  currentPrefs: typeof userPreferencesTable.$inferSelect | null,
  otherProfile: typeof userProfilesTable.$inferSelect | null,
  otherPrefs: typeof userPreferencesTable.$inferSelect | null,
): { score: number; matchReasons: string[] } {
  let score = 0;
  const maxScore = 100;
  const reasons: string[] = [];

  const weights = {
    city: 20,
    budget: 20,
    lifestyle: 15,
    smoking: 10,
    cleanliness: 10,
    sleepSchedule: 8,
    noiseTolerance: 7,
    guestPreference: 4,
    petPreference: 4,
    genderPref: 2,
  };

  if (currentPrefs?.city && otherPrefs?.city) {
    if (currentPrefs.city.toLowerCase() === otherPrefs.city.toLowerCase()) {
      score += weights.city;
      reasons.push(`Same city (${currentPrefs.city})`);
    }
  } else if (!currentPrefs?.city && !otherPrefs?.city) {
    score += weights.city * 0.5;
  }

  const myMin = currentPrefs?.budgetMin ? parseFloat(currentPrefs.budgetMin) : null;
  const myMax = currentPrefs?.budgetMax ? parseFloat(currentPrefs.budgetMax) : null;
  const theirMin = otherPrefs?.budgetMin ? parseFloat(otherPrefs.budgetMin) : null;
  const theirMax = otherPrefs?.budgetMax ? parseFloat(otherPrefs.budgetMax) : null;

  if (myMin !== null && myMax !== null && theirMin !== null && theirMax !== null) {
    const overlapMin = Math.max(myMin, theirMin);
    const overlapMax = Math.min(myMax, theirMax);
    if (overlapMin <= overlapMax) {
      const myRange = myMax - myMin || 1;
      const theirRange = theirMax - theirMin || 1;
      const overlapRange = overlapMax - overlapMin;
      const ratio = overlapRange / Math.max(myRange, theirRange);
      const budgetScore = Math.round(weights.budget * Math.min(ratio + 0.3, 1));
      score += budgetScore;
      reasons.push("Similar budget range");
    }
  } else if (!myMin && !myMax && !theirMin && !theirMax) {
    score += weights.budget * 0.5;
  }

  if (currentPrefs?.lifestyle && otherPrefs?.lifestyle) {
    if (
      currentPrefs.lifestyle === otherPrefs.lifestyle ||
      currentPrefs.lifestyle === "any" ||
      otherPrefs.lifestyle === "any"
    ) {
      score += weights.lifestyle;
      if (currentPrefs.lifestyle === otherPrefs.lifestyle && currentPrefs.lifestyle !== "any") {
        reasons.push(`Both prefer ${currentPrefs.lifestyle} lifestyle`);
      } else {
        reasons.push("Compatible lifestyle preferences");
      }
    }
  }

  if (currentPrefs?.smoking && otherPrefs?.smoking) {
    if (
      currentPrefs.smoking === otherPrefs.smoking ||
      currentPrefs.smoking === "any" ||
      otherPrefs.smoking === "any"
    ) {
      score += weights.smoking;
      if (currentPrefs.smoking === otherPrefs.smoking && currentPrefs.smoking !== "any") {
        reasons.push(currentPrefs.smoking === "no" ? "Both non-smoking" : "Both ok with smoking");
      }
    }
  }

  if (currentProfile?.cleanlinessLevel && otherProfile?.cleanlinessLevel) {
    const levels = ["relaxed", "moderate", "clean", "very_clean"];
    const myIdx = levels.indexOf(currentProfile.cleanlinessLevel);
    const theirIdx = levels.indexOf(otherProfile.cleanlinessLevel);
    const diff = Math.abs(myIdx - theirIdx);
    if (diff === 0) {
      score += weights.cleanliness;
      reasons.push("Same cleanliness standard");
    } else if (diff === 1) {
      score += weights.cleanliness * 0.6;
    }
  }

  if (currentProfile?.sleepSchedule && otherProfile?.sleepSchedule) {
    if (
      currentProfile.sleepSchedule === otherProfile.sleepSchedule ||
      currentProfile.sleepSchedule === "flexible" ||
      otherProfile.sleepSchedule === "flexible"
    ) {
      score += weights.sleepSchedule;
      if (currentProfile.sleepSchedule === otherProfile.sleepSchedule && currentProfile.sleepSchedule !== "flexible") {
        reasons.push(`Both ${currentProfile.sleepSchedule === "early_bird" ? "early risers" : "night owls"}`);
      }
    }
  }

  if (currentProfile?.noiseTolerance && otherProfile?.noiseTolerance) {
    if (currentProfile.noiseTolerance === otherProfile.noiseTolerance) {
      score += weights.noiseTolerance;
      reasons.push(`Same noise tolerance (${currentProfile.noiseTolerance})`);
    } else if (
      (currentProfile.noiseTolerance === "moderate") ||
      (otherProfile.noiseTolerance === "moderate")
    ) {
      score += weights.noiseTolerance * 0.5;
    }
  }

  if (currentProfile?.guestPreference && otherProfile?.guestPreference) {
    if (currentProfile.guestPreference === otherProfile.guestPreference) {
      score += weights.guestPreference;
      reasons.push(`Both prefer guests ${currentProfile.guestPreference}`);
    }
  }

  if (currentProfile?.petPreference && otherProfile?.petPreference) {
    if (
      currentProfile.petPreference === otherProfile.petPreference ||
      currentProfile.petPreference === "no_preference" ||
      otherProfile.petPreference === "no_preference"
    ) {
      score += weights.petPreference;
      if (currentProfile.petPreference === otherProfile.petPreference && currentProfile.petPreference !== "no_preference") {
        reasons.push(currentProfile.petPreference === "love_pets" ? "Both love pets" : "Neither wants pets");
      }
    }
  }

  if (currentPrefs?.genderPref && otherPrefs?.genderPref) {
    const myGenderPref = currentPrefs.genderPref;
    const theirGenderPref = otherPrefs.genderPref;
    const myGender = currentProfile?.gender;
    const theirGender = otherProfile?.gender;

    const iCompatible =
      myGenderPref === "any" ||
      (myGender && myGenderPref === myGender) ||
      !theirGender ||
      theirGenderPref === myGenderPref;

    const theyCompatible =
      theirGenderPref === "any" ||
      (theirGender && theirGenderPref === theirGender) ||
      !myGender;

    if (iCompatible && theyCompatible) {
      score += weights.genderPref;
    }
  }

  const finalScore = Math.min(Math.round((score / maxScore) * 100), 100);
  if (reasons.length === 0 && finalScore > 30) {
    reasons.push("Compatible roommate preferences");
  }

  return { score: finalScore, matchReasons: reasons };
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

      const { score, matchReasons } = computeScore(
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
