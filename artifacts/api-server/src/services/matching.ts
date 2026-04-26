import type { userProfilesTable, userPreferencesTable } from "@workspace/db";

type Profile = typeof userProfilesTable.$inferSelect;
type Prefs = typeof userPreferencesTable.$inferSelect;

export interface MatchScoreBreakdown {
  budget: number;
  lifestyle: number;
  city: number;
  habits: number;
}

export interface MatchScoreResult {
  score: number;
  breakdown: MatchScoreBreakdown;
  matchReasons: string[];
}

const WEIGHTS = {
  budget: 0.4,
  lifestyle: 0.3,
  city: 0.2,
  habits: 0.1,
} as const;

const NEUTRAL = 50;

function parseNum(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

function scoreCity(a: Prefs | null, b: Prefs | null): { score: number; reason: string | null } {
  const aCity = a?.city?.trim();
  const bCity = b?.city?.trim();
  if (!aCity || !bCity) return { score: NEUTRAL, reason: null };
  if (aCity.toLowerCase() === bCity.toLowerCase()) {
    return { score: 100, reason: `Same city (${aCity})` };
  }
  return { score: 0, reason: null };
}

function scoreBudget(a: Prefs | null, b: Prefs | null): { score: number; reason: string | null } {
  const aMin = parseNum(a?.budgetMin);
  const aMax = parseNum(a?.budgetMax);
  const bMin = parseNum(b?.budgetMin);
  const bMax = parseNum(b?.budgetMax);

  const aHas = aMin !== null && aMax !== null;
  const bHas = bMin !== null && bMax !== null;
  if (!aHas || !bHas) return { score: NEUTRAL, reason: null };

  const aLo = Math.min(aMin!, aMax!);
  const aHi = Math.max(aMin!, aMax!);
  const bLo = Math.min(bMin!, bMax!);
  const bHi = Math.max(bMin!, bMax!);

  const overlap = Math.max(0, Math.min(aHi, bHi) - Math.max(aLo, bLo));
  const unionLen = Math.max(aHi, bHi) - Math.min(aLo, bLo);

  if (unionLen === 0) {
    return { score: 100, reason: "Identical budget" };
  }

  const ratio = overlap / unionLen;
  const score = Math.round(ratio * 100);
  let reason: string | null = null;
  if (score >= 75) reason = "Very similar budget range";
  else if (score >= 40) reason = "Overlapping budget range";
  return { score, reason };
}

function scoreLifestyle(a: Prefs | null, b: Prefs | null): { score: number; reason: string | null } {
  const aLs = a?.lifestyle ?? null;
  const bLs = b?.lifestyle ?? null;
  if (!aLs || !bLs) return { score: NEUTRAL, reason: null };
  if (aLs === "any" && bLs === "any") return { score: 100, reason: "Flexible lifestyle on both sides" };
  if (aLs === bLs) return { score: 100, reason: `Both prefer ${aLs} lifestyle` };
  if (aLs === "any" || bLs === "any") return { score: 70, reason: "Compatible lifestyle preferences" };
  return { score: 0, reason: null };
}

function ordinalScore(a: string, b: string, order: readonly string[]): number | null {
  const ai = order.indexOf(a);
  const bi = order.indexOf(b);
  if (ai === -1 || bi === -1) return null;
  const diff = Math.abs(ai - bi);
  if (diff === 0) return 100;
  if (diff === 1) return 60;
  return 0;
}

function categoricalScore(
  a: string,
  b: string,
  neutralValue: string,
  neutralPartial = 70,
): number {
  if (a === b) return 100;
  if (a === neutralValue || b === neutralValue) return neutralPartial;
  return 0;
}

const CLEANLINESS_ORDER = ["relaxed", "moderate", "clean", "very_clean"] as const;
const SLEEP_ORDER = ["early_bird", "flexible", "night_owl"] as const;
const NOISE_ORDER = ["quiet", "moderate", "loud"] as const;
const GUEST_ORDER = ["rarely", "sometimes", "often"] as const;

function scoreHabits(
  aProfile: Profile | null,
  aPrefs: Prefs | null,
  bProfile: Profile | null,
  bPrefs: Prefs | null,
): { score: number; reasons: string[] } {
  const parts: { name: string; value: number; reason: string | null }[] = [];

  if (aProfile?.cleanlinessLevel && bProfile?.cleanlinessLevel) {
    const v = ordinalScore(aProfile.cleanlinessLevel, bProfile.cleanlinessLevel, CLEANLINESS_ORDER);
    if (v !== null) {
      parts.push({
        name: "cleanliness",
        value: v,
        reason: v === 100 ? "Same cleanliness standard" : null,
      });
    }
  }

  if (aProfile?.sleepSchedule && bProfile?.sleepSchedule) {
    const v = ordinalScore(aProfile.sleepSchedule, bProfile.sleepSchedule, SLEEP_ORDER);
    if (v !== null) {
      let reason: string | null = null;
      if (v === 100 && aProfile.sleepSchedule !== "flexible") {
        reason = aProfile.sleepSchedule === "early_bird" ? "Both early risers" : "Both night owls";
      }
      parts.push({ name: "sleep", value: v, reason });
    }
  }

  if (aProfile?.noiseTolerance && bProfile?.noiseTolerance) {
    const v = ordinalScore(aProfile.noiseTolerance, bProfile.noiseTolerance, NOISE_ORDER);
    if (v !== null) {
      parts.push({
        name: "noise",
        value: v,
        reason: v === 100 ? `Same noise tolerance (${aProfile.noiseTolerance})` : null,
      });
    }
  }

  if (aPrefs?.smoking && bPrefs?.smoking) {
    const v = categoricalScore(aPrefs.smoking, bPrefs.smoking, "any");
    let reason: string | null = null;
    if (v === 100 && aPrefs.smoking !== "any") {
      reason = aPrefs.smoking === "no" ? "Both non-smoking" : "Both ok with smoking";
    }
    parts.push({ name: "smoking", value: v, reason });
  }

  if (aProfile?.petPreference && bProfile?.petPreference) {
    const v = categoricalScore(aProfile.petPreference, bProfile.petPreference, "no_preference");
    let reason: string | null = null;
    if (v === 100 && aProfile.petPreference !== "no_preference") {
      reason = aProfile.petPreference === "love_pets" ? "Both love pets" : "Neither wants pets";
    }
    parts.push({ name: "pets", value: v, reason });
  }

  if (aProfile?.guestPreference && bProfile?.guestPreference) {
    const v = ordinalScore(aProfile.guestPreference, bProfile.guestPreference, GUEST_ORDER);
    if (v !== null) {
      parts.push({
        name: "guests",
        value: v,
        reason: v === 100 ? `Both have guests ${aProfile.guestPreference}` : null,
      });
    }
  }

  if (parts.length === 0) {
    return { score: NEUTRAL, reasons: [] };
  }

  const avg = parts.reduce((sum, p) => sum + p.value, 0) / parts.length;
  const reasons = parts.filter(p => p.reason).map(p => p.reason as string);
  return { score: Math.round(avg), reasons };
}

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Compute a roommate match score (0-100) between the current user and a candidate.
 *
 * Pure function — does not touch Express, the DB, or any I/O. Same inputs
 * always produce the same output. Missing fields degrade gracefully to a
 * neutral 50 sub-score (rather than a 0) so absent data does not unfairly
 * penalize either side.
 *
 * Weights: budget 40%, lifestyle 30%, city 20%, habits 10%.
 */
export function computeMatchScore(
  currentProfile: Profile | null,
  currentPrefs: Prefs | null,
  candidateProfile: Profile | null,
  candidatePrefs: Prefs | null,
): MatchScoreResult {
  const city = scoreCity(currentPrefs, candidatePrefs);
  const budget = scoreBudget(currentPrefs, candidatePrefs);
  const lifestyle = scoreLifestyle(currentPrefs, candidatePrefs);
  const habits = scoreHabits(currentProfile, currentPrefs, candidateProfile, candidatePrefs);

  const breakdown: MatchScoreBreakdown = {
    budget: clamp(Math.round(budget.score)),
    lifestyle: clamp(Math.round(lifestyle.score)),
    city: clamp(Math.round(city.score)),
    habits: clamp(Math.round(habits.score)),
  };

  const weighted =
    breakdown.budget * WEIGHTS.budget +
    breakdown.lifestyle * WEIGHTS.lifestyle +
    breakdown.city * WEIGHTS.city +
    breakdown.habits * WEIGHTS.habits;

  const score = clamp(Math.round(weighted));

  const reasons: string[] = [];
  if (city.reason) reasons.push(city.reason);
  if (budget.reason) reasons.push(budget.reason);
  if (lifestyle.reason) reasons.push(lifestyle.reason);
  for (const r of habits.reasons) reasons.push(r);

  if (reasons.length === 0 && score > 30) {
    reasons.push("Compatible roommate preferences");
  }

  return { score, breakdown, matchReasons: reasons };
}
