import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { userProfilesTable, userPreferencesTable } from "@workspace/db";
import { computeMatchScore } from "./matching";

type Profile = typeof userProfilesTable.$inferSelect;
type Prefs = typeof userPreferencesTable.$inferSelect;

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
