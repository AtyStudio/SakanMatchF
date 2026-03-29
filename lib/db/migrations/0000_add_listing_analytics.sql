ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "view_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "contact_click_count" integer DEFAULT 0 NOT NULL;
