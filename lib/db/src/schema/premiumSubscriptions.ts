import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const premiumSubscriptionsTable = pgTable("premium_subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  paypalSubscriptionId: text("paypal_subscription_id").notNull().unique(),
  paypalPlanId: text("paypal_plan_id").notNull(),
  status: text("status", {
    enum: ["pending", "active", "cancelled", "suspended", "expired"],
  })
    .notNull()
    .default("pending"),
  startTime: timestamp("start_time"),
  lastPaymentAt: timestamp("last_payment_at"),
  lastPaymentSaleId: text("last_payment_sale_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertPremiumSubscriptionSchema = createInsertSchema(premiumSubscriptionsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPremiumSubscription = z.infer<typeof insertPremiumSubscriptionSchema>;
export type PremiumSubscription = typeof premiumSubscriptionsTable.$inferSelect;
