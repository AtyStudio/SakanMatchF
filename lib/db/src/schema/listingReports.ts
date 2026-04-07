import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { listingsTable } from "./listings";
import { usersTable } from "./users";

export const listingReportsTable = pgTable("listing_reports", {
  id: serial("id").primaryKey(),
  listingId: integer("listing_id")
    .notNull()
    .references(() => listingsTable.id, { onDelete: "cascade" }),
  reporterId: integer("reporter_id")
    .references(() => usersTable.id, { onDelete: "set null" }),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ListingReport = typeof listingReportsTable.$inferSelect;
