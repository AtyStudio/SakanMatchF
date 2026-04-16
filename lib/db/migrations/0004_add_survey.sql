-- Migration: Add survey support
-- Adds has_completed_survey flag to users and creates survey_responses table

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "has_completed_survey" boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "survey_responses" (
  "id" serial PRIMARY KEY,
  "user_id" integer REFERENCES "users"("id") ON DELETE CASCADE,
  "email" text NOT NULL,
  "answers" jsonb NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);
