import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { userProfilesTable, userPreferencesTable, listingsTable } from "@workspace/db";
import { computeMatchScore, computeListingMatchScore, hasUsefulPreferences } from "./matching";

type Profile = typeof userProfilesTable.$inferSelect;
type Prefs = typeof userPreferencesTable.$inferSelect;
type Listing = typeof listingsTable.$inferSelect;

const baseProfile: Profile = {
  id: 1,
  userId: 1,
  fullName: null,
  age: null,
  gender: null,
  occupation: null,
  cleanlinessLevel: null,
  sleepSchedule: null,
  noiseTolerance: null,
  guestPreference: null,
  petPreference: null,
  bio: null,
  moveInDate: null,
  avatarUrl: null,
  updatedAt: new Date(0),
};

const basePrefs: Prefs = {
  id: 1,
  userId: 1,
  city: null,
  budgetMin: null,
  budgetMax: null,
  lifestyle: null,
  smoking: null,
  genderPref: null,
  wantedAmenities: [],
  updatedAt: new Date(0),
};

function profile(overrides: Partial<Profile> = {}): Profile {
  return { ...baseProfile, ...overrides };
}

function prefs(overrides: Partial<Prefs> = {}): Prefs {
  return { ...basePrefs, ...overrides };
}

const baseListing: Listing = {
  id: 1,
  title: "Test listing",
  description: null,
  price: "2500",
  city: "Riyadh",
  images: [],
  ownerId: 1,
  viewCount: 0,
  contactClickCount: 0,
  createdAt: new Date(0),
  propertyType: null,
  bedrooms: null,
  bathrooms: null,
  area: null,
  floor: null,
  isFurnished: null,
  neighborhood: null,
  amenities: [],
  deposit: null,
  billsIncluded: null,
  agencyFees: null,
  availableFrom: null,
  smokingAllowed: null,
  petsAllowed: null,
  guestsAllowed: null,
  genderPreference: null,
  quietHours: null,
  minStay: null,
  maxStay: null,
  roommateNote: null,
  latitude: null,
  longitude: null,
  address: null,
};

function listing(overrides: Partial<Listing> = {}): Listing {
  return { ...baseListing, ...overrides };
}

describe("computeMatchScore", () => {
  it("returns a neutral score (~50) when all inputs are null", () => {
    const result = computeMatchScore(null, null, null, null);
    assert.equal(result.score, 50);
    assert.deepEqual(result.breakdown, {
      budget: 50,
      lifestyle: 50,
      city: 50,
      habits: 50,
    });
  });

  it("returns a neutral score (~50) when both sides have empty profile/prefs objects", () => {
    const result = computeMatchScore(profile(), prefs(), profile(), prefs());
    assert.equal(result.score, 50);
    assert.deepEqual(result.breakdown, {
      budget: 50,
      lifestyle: 50,
      city: 50,
      habits: 50,
    });
  });

  it("returns 100 for a perfect match", () => {
    const p = profile({
      cleanlinessLevel: "very_clean",
      sleepSchedule: "early_bird",
      noiseTolerance: "quiet",
      guestPreference: "rarely",
      petPreference: "love_pets",
    });
    const pr = prefs({
      city: "Riyadh",
      budgetMin: "2000",
      budgetMax: "3000",
      lifestyle: "quiet",
      smoking: "no",
    });

    const result = computeMatchScore(p, pr, p, pr);
    assert.equal(result.score, 100);
    assert.deepEqual(result.breakdown, {
      budget: 100,
      lifestyle: 100,
      city: 100,
      habits: 100,
    });
  });

  it("returns budget=0 for disjoint budget ranges", () => {
    const a = prefs({ budgetMin: "1000", budgetMax: "2000" });
    const b = prefs({ budgetMin: "5000", budgetMax: "6000" });
    const result = computeMatchScore(null, a, null, b);
    assert.equal(result.breakdown.budget, 0);
  });

  it("is deterministic — same inputs always produce the same result", () => {
    const p = profile({
      cleanlinessLevel: "clean",
      sleepSchedule: "night_owl",
      noiseTolerance: "moderate",
      guestPreference: "sometimes",
      petPreference: "no_pets",
    });
    const q = profile({
      cleanlinessLevel: "moderate",
      sleepSchedule: "flexible",
      noiseTolerance: "moderate",
      guestPreference: "sometimes",
      petPreference: "no_preference",
    });
    const pr1 = prefs({
      city: "Jeddah",
      budgetMin: "2000",
      budgetMax: "3500",
      lifestyle: "social",
      smoking: "no",
    });
    const pr2 = prefs({
      city: "jeddah",
      budgetMin: "2500",
      budgetMax: "4000",
      lifestyle: "any",
      smoking: "any",
    });

    const r1 = computeMatchScore(p, pr1, q, pr2);
    const r2 = computeMatchScore(p, pr1, q, pr2);
    const r3 = computeMatchScore(p, pr1, q, pr2);
    assert.deepEqual(r1, r2);
    assert.deepEqual(r2, r3);
  });

  it("applies sub-score weights correctly (budget 40 / lifestyle 30 / city 20 / habits 10)", () => {
    // Construct a scenario where:
    //   budget    = 100  (identical ranges)
    //   lifestyle = 0    (quiet vs social)
    //   city      = 100  (same city)
    //   habits    = 0    (opposite ordinals + opposite categoricals)
    // Expected weighted score = 100*0.4 + 0*0.3 + 100*0.2 + 0*0.1 = 60
    const p = profile({
      cleanlinessLevel: "very_clean",
      sleepSchedule: "early_bird",
      noiseTolerance: "quiet",
      guestPreference: "rarely",
      petPreference: "love_pets",
    });
    const q = profile({
      cleanlinessLevel: "relaxed",
      sleepSchedule: "night_owl",
      noiseTolerance: "loud",
      guestPreference: "often",
      petPreference: "no_pets",
    });
    const pr1 = prefs({
      city: "Riyadh",
      budgetMin: "2000",
      budgetMax: "3000",
      lifestyle: "quiet",
      smoking: "no",
    });
    const pr2 = prefs({
      city: "Riyadh",
      budgetMin: "2000",
      budgetMax: "3000",
      lifestyle: "social",
      smoking: "yes",
    });

    const result = computeMatchScore(p, pr1, q, pr2);
    assert.equal(result.breakdown.budget, 100);
    assert.equal(result.breakdown.lifestyle, 0);
    assert.equal(result.breakdown.city, 100);
    assert.equal(result.breakdown.habits, 0);
    assert.equal(result.score, 60);
  });

  it("applies sub-score weights correctly when only city matches", () => {
    // budget = neutral 50, lifestyle = neutral 50, city = 100, habits = neutral 50
    // Weighted = 50*0.4 + 50*0.3 + 100*0.2 + 50*0.1 = 20 + 15 + 20 + 5 = 60
    const result = computeMatchScore(
      null,
      prefs({ city: "Riyadh" }),
      null,
      prefs({ city: "Riyadh" }),
    );
    assert.equal(result.breakdown.city, 100);
    assert.equal(result.breakdown.budget, 50);
    assert.equal(result.breakdown.lifestyle, 50);
    assert.equal(result.breakdown.habits, 50);
    assert.equal(result.score, 60);
  });

  describe("adjacent ordinal habits get partial credit", () => {
    it("gives partial credit for adjacent cleanliness levels", () => {
      const p = profile({ cleanlinessLevel: "very_clean" });
      const q = profile({ cleanlinessLevel: "clean" });
      const result = computeMatchScore(p, null, q, null);
      // Only one habit factor present, so habits sub-score == its value (60).
      assert.equal(result.breakdown.habits, 60);
    });

    it("gives partial credit for adjacent sleep schedules", () => {
      const p = profile({ sleepSchedule: "early_bird" });
      const q = profile({ sleepSchedule: "flexible" });
      const result = computeMatchScore(p, null, q, null);
      assert.equal(result.breakdown.habits, 60);
    });

    it("gives partial credit for adjacent noise tolerances", () => {
      const p = profile({ noiseTolerance: "quiet" });
      const q = profile({ noiseTolerance: "moderate" });
      const result = computeMatchScore(p, null, q, null);
      assert.equal(result.breakdown.habits, 60);
    });

    it("gives partial credit for adjacent guest preferences", () => {
      const p = profile({ guestPreference: "rarely" });
      const q = profile({ guestPreference: "sometimes" });
      const result = computeMatchScore(p, null, q, null);
      assert.equal(result.breakdown.habits, 60);
    });

    it("gives 0 credit for two-step-apart ordinals", () => {
      const p = profile({ cleanlinessLevel: "very_clean" });
      const q = profile({ cleanlinessLevel: "moderate" });
      const result = computeMatchScore(p, null, q, null);
      assert.equal(result.breakdown.habits, 0);
    });

    it("gives 100 for identical ordinals", () => {
      const p = profile({ noiseTolerance: "moderate" });
      const q = profile({ noiseTolerance: "moderate" });
      const result = computeMatchScore(p, null, q, null);
      assert.equal(result.breakdown.habits, 100);
    });
  });

  describe("city matching is case-insensitive", () => {
    it("matches identical city strings", () => {
      const result = computeMatchScore(
        null,
        prefs({ city: "Riyadh" }),
        null,
        prefs({ city: "Riyadh" }),
      );
      assert.equal(result.breakdown.city, 100);
    });

    it("matches city strings with different casing", () => {
      const result = computeMatchScore(
        null,
        prefs({ city: "Riyadh" }),
        null,
        prefs({ city: "riyadh" }),
      );
      assert.equal(result.breakdown.city, 100);
    });

    it("matches city strings with mixed casing and surrounding whitespace", () => {
      const result = computeMatchScore(
        null,
        prefs({ city: "  JEDDAH  " }),
        null,
        prefs({ city: "jeddah" }),
      );
      assert.equal(result.breakdown.city, 100);
    });

    it("returns 0 city score for different cities", () => {
      const result = computeMatchScore(
        null,
        prefs({ city: "Riyadh" }),
        null,
        prefs({ city: "Jeddah" }),
      );
      assert.equal(result.breakdown.city, 0);
    });
  });
});

describe("hasUsefulPreferences", () => {
  it("returns false for null prefs", () => {
    assert.equal(hasUsefulPreferences(null), false);
  });

  it("returns false when prefs are all default/empty", () => {
    assert.equal(hasUsefulPreferences(prefs()), false);
  });

  it("returns false when prefs only contain 'any' values", () => {
    assert.equal(
      hasUsefulPreferences(prefs({ lifestyle: "any", smoking: "any", genderPref: "any" })),
      false,
    );
  });

  it("returns false for whitespace-only city", () => {
    assert.equal(hasUsefulPreferences(prefs({ city: "   " })), false);
  });

  it("returns true when city is set", () => {
    assert.equal(hasUsefulPreferences(prefs({ city: "Riyadh" })), true);
  });

  it("returns true when budget is set", () => {
    assert.equal(hasUsefulPreferences(prefs({ budgetMin: "1000" })), true);
  });

  it("returns true when lifestyle is set to a real value", () => {
    assert.equal(hasUsefulPreferences(prefs({ lifestyle: "quiet" })), true);
  });

  it("returns true when wantedAmenities is non-empty", () => {
    assert.equal(hasUsefulPreferences(prefs({ wantedAmenities: ["wifi"] })), true);
  });
});

describe("computeListingMatchScore", () => {
  it("returns a neutral 50 score when prefs are null (every factor neutral)", () => {
    const result = computeListingMatchScore(null, listing());
    assert.equal(result.breakdown.city, 50);
    assert.equal(result.breakdown.budget, 50);
    assert.equal(result.breakdown.lifestyle, 50);
    assert.equal(result.breakdown.smoking, 50);
    assert.equal(result.breakdown.amenities, 50);
    assert.equal(result.score, 50);
  });

  it("returns a perfect 100 when every factor matches", () => {
    const p = prefs({
      city: "Riyadh",
      budgetMin: "2000",
      budgetMax: "3000",
      lifestyle: "social",
      smoking: "no",
      wantedAmenities: ["wifi", "parking"],
    });
    const l = listing({
      city: "Riyadh",
      price: "2500",
      smokingAllowed: false,
      guestsAllowed: true,
      amenities: ["wifi", "parking", "ac"],
    });
    const result = computeListingMatchScore(p, l);
    assert.equal(result.breakdown.city, 100);
    assert.equal(result.breakdown.budget, 100);
    assert.equal(result.breakdown.lifestyle, 100);
    assert.equal(result.breakdown.smoking, 100);
    assert.equal(result.breakdown.amenities, 100);
    assert.equal(result.score, 100);
  });

  it("city match is case-insensitive", () => {
    const result = computeListingMatchScore(
      prefs({ city: "riyadh" }),
      listing({ city: "RIYADH" }),
    );
    assert.equal(result.breakdown.city, 100);
  });

  it("scores city 0 when cities are different", () => {
    const result = computeListingMatchScore(
      prefs({ city: "Riyadh" }),
      listing({ city: "Jeddah" }),
    );
    assert.equal(result.breakdown.city, 0);
  });

  it("budget gets 100 within range", () => {
    const result = computeListingMatchScore(
      prefs({ budgetMin: "2000", budgetMax: "3000" }),
      listing({ price: "2500" }),
    );
    assert.equal(result.breakdown.budget, 100);
  });

  it("budget gets 0 when far over max", () => {
    const result = computeListingMatchScore(
      prefs({ budgetMin: "2000", budgetMax: "3000" }),
      listing({ price: "5000" }),
    );
    assert.equal(result.breakdown.budget, 0);
  });

  it("budget gets partial credit when slightly over max (<= 20% over)", () => {
    const result = computeListingMatchScore(
      prefs({ budgetMin: "2000", budgetMax: "3000" }),
      listing({ price: "3300" }),
    );
    // 10% over -> 100 - 10*250/100 = 75
    assert.equal(result.breakdown.budget, 75);
  });

  it("smoking: pref 'no' + listing not allowed -> 100", () => {
    const result = computeListingMatchScore(
      prefs({ smoking: "no" }),
      listing({ smokingAllowed: false }),
    );
    assert.equal(result.breakdown.smoking, 100);
  });

  it("smoking: pref 'no' + listing allowed -> 0", () => {
    const result = computeListingMatchScore(
      prefs({ smoking: "no" }),
      listing({ smokingAllowed: true }),
    );
    assert.equal(result.breakdown.smoking, 0);
  });

  it("amenities: scores by ratio of wanted amenities present", () => {
    const result = computeListingMatchScore(
      prefs({ wantedAmenities: ["wifi", "parking", "ac", "kitchen"] }),
      listing({ amenities: ["wifi", "parking"] }),
    );
    assert.equal(result.breakdown.amenities, 50);
  });

  it("amenities: 100 when all wanted are present", () => {
    const result = computeListingMatchScore(
      prefs({ wantedAmenities: ["wifi"] }),
      listing({ amenities: ["wifi", "parking"] }),
    );
    assert.equal(result.breakdown.amenities, 100);
  });

  it("lifestyle 'quiet' rewards listings with quiet hours", () => {
    const result = computeListingMatchScore(
      prefs({ lifestyle: "quiet" }),
      listing({ quietHours: "10pm - 7am" }),
    );
    assert.equal(result.breakdown.lifestyle, 100);
  });

  it("lifestyle 'social' is incompatible with no-guests listings", () => {
    const result = computeListingMatchScore(
      prefs({ lifestyle: "social" }),
      listing({ guestsAllowed: false }),
    );
    assert.equal(result.breakdown.lifestyle, 0);
  });

  it("applies weights correctly: city 30 / budget 35 / lifestyle 10 / smoking 10 / amenities 15", () => {
    const result = computeListingMatchScore(
      prefs({ city: "Riyadh", budgetMin: "10000", budgetMax: "20000" }),
      listing({ city: "Riyadh", price: "2500" }),
    );
    assert.equal(result.breakdown.city, 100);
    assert.equal(result.breakdown.budget, 0);
    assert.equal(result.breakdown.lifestyle, 50);
    assert.equal(result.breakdown.smoking, 50);
    assert.equal(result.breakdown.amenities, 50);
    // city*0.3 + budget*0.35 + lifestyle*0.1 + smoking*0.1 + amenities*0.15
    //  = 30 + 0 + 5 + 5 + 7.5 = 47.5 -> 48
    assert.equal(result.score, 48);
  });

  it("is deterministic across repeated calls", () => {
    const p = prefs({
      city: "Jeddah",
      budgetMin: "2000",
      budgetMax: "3500",
      lifestyle: "social",
      smoking: "no",
      wantedAmenities: ["wifi"],
    });
    const l = listing({
      city: "Jeddah",
      price: "2800",
      smokingAllowed: false,
      guestsAllowed: true,
      amenities: ["wifi"],
    });
    const r1 = computeListingMatchScore(p, l);
    const r2 = computeListingMatchScore(p, l);
    assert.deepEqual(r1, r2);
  });
});
