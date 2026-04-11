import { pgTable, serial, text, numeric, integer, timestamp, boolean, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const listingsTable = pgTable("listings", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  city: text("city").notNull(),
  images: text("images").array().notNull().default([]),
  ownerId: integer("owner_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  viewCount: integer("view_count").notNull().default(0),
  contactClickCount: integer("contact_click_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  propertyType: text("property_type"),
  bedrooms: integer("bedrooms"),
  bathrooms: integer("bathrooms"),
  area: numeric("area", { precision: 8, scale: 2 }),
  floor: integer("floor"),
  isFurnished: boolean("is_furnished"),
  neighborhood: text("neighborhood"),
  amenities: text("amenities").array().notNull().default([]),
  deposit: numeric("deposit", { precision: 10, scale: 2 }),
  billsIncluded: boolean("bills_included"),
  agencyFees: numeric("agency_fees", { precision: 10, scale: 2 }),
  availableFrom: date("available_from"),
  smokingAllowed: boolean("smoking_allowed"),
  petsAllowed: boolean("pets_allowed"),
  guestsAllowed: boolean("guests_allowed"),
  genderPreference: text("gender_preference"),
  quietHours: text("quiet_hours"),
  minStay: integer("min_stay"),
  maxStay: integer("max_stay"),
  roommateNote: text("roommate_note"),
  latitude: numeric("latitude", { precision: 9, scale: 6 }),
  longitude: numeric("longitude", { precision: 9, scale: 6 }),
  address: text("address"),
});

export const insertListingSchema = createInsertSchema(listingsTable).omit({ id: true, createdAt: true });
export type InsertListing = z.infer<typeof insertListingSchema>;
export type Listing = typeof listingsTable.$inferSelect;
