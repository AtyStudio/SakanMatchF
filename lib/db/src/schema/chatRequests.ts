import { pgTable, serial, integer, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { usersTable } from "./users";

export const chatRequestsTable = pgTable("chat_requests", {
  id: serial("id").primaryKey(),
  senderId: integer("sender_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  receiverId: integer("receiver_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  status: text("status", { enum: ["pending", "accepted", "declined", "cancelled"] })
    .notNull()
    .default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("chat_requests_pair_unique").on(
    sql`LEAST(${table.senderId}, ${table.receiverId})`,
    sql`GREATEST(${table.senderId}, ${table.receiverId})`
  ),
]);

export type ChatRequest = typeof chatRequestsTable.$inferSelect;
