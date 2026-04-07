import { pgTable, serial, integer, text, numeric, timestamp, boolean } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const userPreferencesTable = pgTable("user_preferences", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .unique()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  city: text("city"),
  budgetMin: numeric("budget_min", { precision: 10, scale: 2 }),
  budgetMax: numeric("budget_max", { precision: 10, scale: 2 }),
  lifestyle: text("lifestyle", { enum: ["quiet", "social", "any"] }).default("any"),
  smoking: text("smoking", { enum: ["yes", "no", "any"] }).default("any"),
  genderPref: text("gender_pref", { enum: ["male", "female", "any"] }).default("any"),
  wantedAmenities: text("wanted_amenities").array().notNull().default([]),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type UserPreferences = typeof userPreferencesTable.$inferSelect;
