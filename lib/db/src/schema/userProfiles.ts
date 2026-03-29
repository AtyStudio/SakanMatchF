import { pgTable, serial, integer, text, numeric, timestamp, date } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const userProfilesTable = pgTable("user_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .unique()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  fullName: text("full_name"),
  age: integer("age"),
  gender: text("gender", { enum: ["male", "female", "other"] }),
  occupation: text("occupation"),
  cleanlinessLevel: text("cleanliness_level", { enum: ["very_clean", "clean", "moderate", "relaxed"] }),
  sleepSchedule: text("sleep_schedule", { enum: ["early_bird", "night_owl", "flexible"] }),
  noiseTolerance: text("noise_tolerance", { enum: ["quiet", "moderate", "loud"] }),
  guestPreference: text("guest_preference", { enum: ["rarely", "sometimes", "often"] }),
  petPreference: text("pet_preference", { enum: ["love_pets", "no_pets", "no_preference"] }),
  bio: text("bio"),
  moveInDate: date("move_in_date"),
  avatarUrl: text("avatar_url"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type UserProfile = typeof userProfilesTable.$inferSelect;
