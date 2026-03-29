-- Migration: Add user_profiles table for extended roommate profile data
-- This table stores additional profile fields beyond user_preferences for the
-- people-matching system, allowing users to find compatible roommates.

CREATE TABLE IF NOT EXISTS "user_profiles" (
  "id" serial PRIMARY KEY,
  "user_id" integer NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
  "full_name" text,
  "age" integer,
  "gender" text CHECK ("gender" IN ('male', 'female', 'other')),
  "occupation" text,
  "cleanliness_level" text CHECK ("cleanliness_level" IN ('very_clean', 'clean', 'moderate', 'relaxed')),
  "sleep_schedule" text CHECK ("sleep_schedule" IN ('early_bird', 'night_owl', 'flexible')),
  "noise_tolerance" text CHECK ("noise_tolerance" IN ('quiet', 'moderate', 'loud')),
  "guest_preference" text CHECK ("guest_preference" IN ('rarely', 'sometimes', 'often')),
  "pet_preference" text CHECK ("pet_preference" IN ('love_pets', 'no_pets', 'no_preference')),
  "bio" text,
  "move_in_date" date,
  "avatar_url" text,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
