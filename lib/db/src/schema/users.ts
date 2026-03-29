import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  password: text("password").notNull(),
  role: text("role", { enum: ["owner", "seeker"] }).notNull().default("seeker"),
  isPremium: boolean("is_premium").notNull().default(false),
  premiumActivatedAt: timestamp("premium_activated_at"),
  premiumSource: text("premium_source"),
  paypalSubscriptionId: text("paypal_subscription_id"),
  subscriptionStatus: text("subscription_status"),
  subscriptionPlanId: text("subscription_plan_id"),
  lastPaymentAt: timestamp("last_payment_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
