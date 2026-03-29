-- Migration: Drop legacy one-time payment table
-- The premium_purchases table was used for the old one-time PayPal payment flow.
-- It has been replaced by the premium_subscriptions table for the subscription-based model.
-- This migration drops the table if it exists (idempotent).

DROP TABLE IF EXISTS "premium_purchases";

-- Migration: Add last_payment_sale_id to premium_subscriptions for idempotent webhook processing
-- This column stores the PayPal sale transaction ID from PAYMENT.SALE.COMPLETED events,
-- preventing duplicate webhook deliveries from double-recording payments.

ALTER TABLE "premium_subscriptions" ADD COLUMN IF NOT EXISTS "last_payment_sale_id" text;
