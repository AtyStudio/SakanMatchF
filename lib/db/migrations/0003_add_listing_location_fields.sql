-- Migration: Add location fields to listings table
-- Adds latitude, longitude (premium map pin) and address (free text) columns
-- to support the premium-gated interactive map picker feature.

ALTER TABLE "listings"
  ADD COLUMN IF NOT EXISTS "latitude" numeric(9, 6),
  ADD COLUMN IF NOT EXISTS "longitude" numeric(9, 6),
  ADD COLUMN IF NOT EXISTS "address" text;
