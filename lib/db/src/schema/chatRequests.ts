import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
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
});

export type ChatRequest = typeof chatRequestsTable.$inferSelect;
