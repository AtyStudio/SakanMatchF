import type { userProfilesTable, userPreferencesTable, listingsTable } from "@workspace/db";

type Profile = typeof userProfilesTable.$inferSelect;
type Prefs = typeof userPreferencesTable.$inferSelect;
type Listing = typeof listingsTable.$inferSelect;

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

export interface ListingMatchBreakdown {
  city: number;
  budget: number;
  lifestyle: number;
  smoking: number;
  amenities: number;
}

export interface ListingMatchResult {
  score: number;
  breakdown: ListingMatchBreakdown;
  matchReasons: string[];
}

const LISTING_WEIGHTS = {
  city: 0.3,
  budget: 0.35,
  lifestyle: 0.1,
  smoking: 0.1,
  amenities: 0.15,
} as const;

function scoreListingCity(
  prefs: Prefs | null,
  listing: Pick<Listing, "city">,
): { score: number; reason: string | null } {
  const prefCity = prefs?.city?.trim();
  const listingCity = listing.city?.trim();
  if (!prefCity) return { score: NEUTRAL, reason: null };
  if (!listingCity) return { score: NEUTRAL, reason: null };
  const a = prefCity.toLowerCase();
  const b = listingCity.toLowerCase();
  if (a === b) return { score: 100, reason: `Same city (${listingCity})` };
  if (b.includes(a) || a.includes(b)) {
    return { score: 70, reason: `Nearby area (${listingCity})` };
  }
  return { score: 0, reason: null };
}

function scoreListingBudget(
  prefs: Prefs | null,
  listing: Pick<Listing, "price">,
): { score: number; reason: string | null } {
  const min = parseNum(prefs?.budgetMin);
  const max = parseNum(prefs?.budgetMax);
  const price = parseNum(listing.price);
  if (price === null) return { score: NEUTRAL, reason: null };
  if (min === null && max === null) return { score: NEUTRAL, reason: null };

  const lo = min ?? 0;
  const hi = max ?? Number.POSITIVE_INFINITY;

  if (price >= lo && price <= hi) {
    return { score: 100, reason: "Within your budget" };
  }
  if (max !== null && price > max && max > 0) {
    const over = (price - max) / max;
    if (over <= 0.2) {
      return { score: Math.max(0, Math.round(100 - over * 250)), reason: null };
    }
  }
  if (min !== null && price < min && min > 0) {
    const under = (min - price) / min;
    if (under <= 0.2) return { score: 80, reason: "Cheaper than your minimum budget" };
  }
  return { score: 0, reason: null };
}

function scoreListingLifestyle(
  prefs: Prefs | null,
  listing: Pick<Listing, "quietHours" | "guestsAllowed" | "smokingAllowed">,
): { score: number; reason: string | null } {
  const lifestyle = prefs?.lifestyle ?? null;
  if (!lifestyle) return { score: NEUTRAL, reason: null };
  if (lifestyle === "any") return { score: 100, reason: null };
  if (lifestyle === "quiet") {
    if (listing.quietHours) {
      return { score: 100, reason: "Quiet hours match your lifestyle" };
    }
    if (listing.guestsAllowed === false || listing.smokingAllowed === false) {
      return { score: 75, reason: null };
    }
    return { score: NEUTRAL, reason: null };
  }
  if (lifestyle === "social") {
    if (listing.guestsAllowed === true) {
      return { score: 100, reason: "Guests welcome — fits a social lifestyle" };
    }
    if (listing.guestsAllowed === false) {
      return { score: 0, reason: null };
    }
    return { score: NEUTRAL, reason: null };
  }
  return { score: NEUTRAL, reason: null };
}

function scoreListingSmoking(
  prefs: Prefs | null,
  listing: Pick<Listing, "smokingAllowed">,
): { score: number; reason: string | null } {
  const pref = prefs?.smoking ?? null;
  if (!pref) return { score: NEUTRAL, reason: null };
  if (pref === "any") return { score: 100, reason: null };
  if (listing.smokingAllowed === null || listing.smokingAllowed === undefined) {
    return { score: NEUTRAL, reason: null };
  }
  if (pref === "yes" && listing.smokingAllowed === true) {
    return { score: 100, reason: "Smoking allowed" };
  }
  if (pref === "no" && listing.smokingAllowed === false) {
    return { score: 100, reason: "Non-smoking property" };
  }
  return { score: 0, reason: null };
}

function scoreListingAmenities(
  prefs: Prefs | null,
  listing: Pick<Listing, "amenities">,
): { score: number; reason: string | null } {
  const wanted = prefs?.wantedAmenities ?? [];
  if (wanted.length === 0) return { score: NEUTRAL, reason: null };
  const have = listing.amenities ?? [];
  if (have.length === 0) return { score: 0, reason: null };
  const matched = wanted.filter((a: string) => have.includes(a));
  const ratio = matched.length / wanted.length;
  const score = Math.round(ratio * 100);
  let reason: string | null = null;
  if (matched.length === wanted.length) {
    reason = "Has all amenities you want";
  } else if (matched.length > 0) {
    reason = `Has ${matched.length} of ${wanted.length} amenities you want`;
  }
  return { score, reason };
}

/**
 * Returns true when the user's preferences contain at least one signal that
 * meaningfully constrains the match. Prefs filled only with default "any"
 * values do not count — there is nothing to score against.
 */
export function hasUsefulPreferences(prefs: Prefs | null): boolean {
  if (!prefs) return false;
  return Boolean(
    (prefs.city && prefs.city.trim()) ||
      prefs.budgetMin ||
      prefs.budgetMax ||
      (prefs.lifestyle && prefs.lifestyle !== "any") ||
      (prefs.smoking && prefs.smoking !== "any") ||
      (prefs.wantedAmenities && prefs.wantedAmenities.length > 0),
  );
}

/**
 * Compute an apartment-listing match score (0-100) for a user's preferences.
 *
 * Pure function — same inputs always produce the same output. Missing
 * prefs/fields degrade gracefully to a neutral 50 sub-score so absent data
 * does not unfairly penalize a listing.
 *
 * Weights: budget 35%, city 30%, amenities 15%, lifestyle 10%, smoking 10%.
 *
 * Used by both the Dashboard "Top Matches" rail and the Listing Detail page,
 * which previously rolled their own ad-hoc scoring functions with different
 * weights — meaning the same listing could appear with two different scores.
 */
export function computeListingMatchScore(
  prefs: Prefs | null,
  listing: Pick<
    Listing,
    "city" | "price" | "amenities" | "smokingAllowed" | "guestsAllowed" | "quietHours"
  >,
): ListingMatchResult {
  const city = scoreListingCity(prefs, listing);
  const budget = scoreListingBudget(prefs, listing);
  const lifestyle = scoreListingLifestyle(prefs, listing);
  const smoking = scoreListingSmoking(prefs, listing);
  const amenities = scoreListingAmenities(prefs, listing);

  const breakdown: ListingMatchBreakdown = {
    city: clamp(Math.round(city.score)),
    budget: clamp(Math.round(budget.score)),
    lifestyle: clamp(Math.round(lifestyle.score)),
    smoking: clamp(Math.round(smoking.score)),
    amenities: clamp(Math.round(amenities.score)),
  };

  const weighted =
    breakdown.city * LISTING_WEIGHTS.city +
    breakdown.budget * LISTING_WEIGHTS.budget +
    breakdown.lifestyle * LISTING_WEIGHTS.lifestyle +
    breakdown.smoking * LISTING_WEIGHTS.smoking +
    breakdown.amenities * LISTING_WEIGHTS.amenities;

  const score = clamp(Math.round(weighted));

  const reasons: string[] = [];
  for (const r of [city.reason, budget.reason, amenities.reason, lifestyle.reason, smoking.reason]) {
    if (r) reasons.push(r);
  }

  return { score, breakdown, matchReasons: reasons };
}
