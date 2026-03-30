import { Router, type Request } from "express";
import { db, usersTable, premiumSubscriptionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { logger } from "../lib/logger";

const router = Router();

const PAYPAL_BASE_URL = "https://api-m.sandbox.paypal.com";

function getPayPalCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("PayPal credentials (PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET) are not configured");
  }
  return { clientId, clientSecret };
}

function getPayPalWebhookId(): string {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) {
    throw new Error("PAYPAL_WEBHOOK_ID is not configured");
  }
  return webhookId;
}

{
  const missing = (["PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET", "PAYPAL_WEBHOOK_ID"] as const).filter(
    (key) => !process.env[key],
  );
  if (missing.length > 0) {
    logger.warn({ missingVars: missing }, "PayPal credential(s) missing — subscription features will not work");
  } else {
    logger.info("PayPal credentials present — subscription features available");
  }

  const webhookUrl = `https://${process.env.REPLIT_DEV_DOMAIN ?? "localhost"}/api/paypal/webhook`;
  logger.info({ webhookUrl }, "PayPal webhook URL — register this in the PayPal sandbox dashboard");
}

function getAppBaseUrl(req?: AuthRequest): string {
  if (process.env.APP_BASE_URL) {
    return process.env.APP_BASE_URL.replace(/\/$/, "");
  }

  const origin = req?.get("origin") || req?.get("referer");
  if (origin) {
    try {
      return new URL(origin).origin;
    } catch {
    }
  }

  const replitDomains = process.env.REPLIT_DOMAINS?.split(",")[0]?.trim();
  if (replitDomains) {
    return `https://${replitDomains}`;
  }
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }
  return "http://localhost:3000";
}

let cachedPlanId = process.env.PAYPAL_PREMIUM_PLAN_ID || "";

async function getPayPalAccessToken(): Promise<string> {
  const { clientId, clientSecret } = getPayPalCredentials();
  const credentials = Buffer.from(
    `${clientId}:${clientSecret}`,
  ).toString("base64");
  const response = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    let errBody: unknown;
    try { errBody = await response.json(); } catch { errBody = await response.text(); }
    logger.error({ status: response.status, paypalError: errBody }, "PayPal access token request failed");
    throw new Error(`Failed to get PayPal token: ${response.status}`);
  }

  const data = (await response.json()) as { access_token: string };
  return data.access_token;
}

async function ensurePlanId(log: any): Promise<string> {
  if (cachedPlanId) {
    return cachedPlanId;
  }

  const accessToken = await getPayPalAccessToken();

  const productRes = await fetch(`${PAYPAL_BASE_URL}/v1/catalogs/products`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "SakanMatch Premium",
      description: "Monthly premium subscription for SakanMatch property owners",
      type: "SERVICE",
      category: "SOFTWARE",
    }),
  });

  if (!productRes.ok) {
    let errBody: unknown;
    try { errBody = await productRes.json(); } catch { errBody = await productRes.text(); }
    log.error({ status: productRes.status, paypalError: errBody }, "PayPal create product failed");
    throw new Error(`Failed to create product: ${productRes.status}`);
  }

  const product = (await productRes.json()) as { id: string };
  log.info({ productId: product.id }, "Created PayPal product");

  const planRes = await fetch(`${PAYPAL_BASE_URL}/v1/billing/plans`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      product_id: product.id,
      name: "SakanMatch Premium Monthly",
      description: "Monthly premium subscription for SakanMatch",
      billing_cycles: [
        {
          frequency: { interval_unit: "MONTH", interval_count: 1 },
          tenure_type: "REGULAR",
          sequence: 1,
          total_cycles: 0,
          pricing_scheme: {
            fixed_price: { value: "9.99", currency_code: "USD" },
          },
        },
      ],
      payment_preferences: {
        auto_bill_outstanding: true,
        payment_failure_threshold: 3,
      },
    }),
  });

  if (!planRes.ok) {
    let errBody: unknown;
    try { errBody = await planRes.json(); } catch { errBody = await planRes.text(); }
    log.error({ status: planRes.status, paypalError: errBody }, "PayPal create plan failed");
    throw new Error(`Failed to create plan: ${planRes.status}`);
  }

  const plan = (await planRes.json()) as { id: string };
  log.info(
    { planId: plan.id },
    "Created PayPal billing plan. Set PAYPAL_PREMIUM_PLAN_ID to reuse.",
  );

  cachedPlanId = plan.id;
  return plan.id;
}

router.post(
  "/create-subscription",
  requireAuth,
  async (req: AuthRequest, res) => {
    const user = req.user!;

    if (user.role !== "owner") {
      res.status(403).json({
        error: "Forbidden",
        message: "Only owners can subscribe to premium",
      });
      return;
    }

    if (user.isPremium && user.subscriptionStatus === "active") {
      res.status(400).json({
        error: "Already active",
        message: "You already have an active premium subscription",
      });
      return;
    }

    try {
      const planId = await ensurePlanId(req.log);
      const accessToken = await getPayPalAccessToken();

      const baseUrl = getAppBaseUrl(req);
      req.log.info({ baseUrl }, "PayPal subscription return URL base");

      const subscriptionRes = await fetch(
        `${PAYPAL_BASE_URL}/v1/billing/subscriptions`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            plan_id: planId,
            custom_id: String(user.id),
            application_context: {
              brand_name: "SakanMatch",
              user_action: "SUBSCRIBE_NOW",
              return_url: `${baseUrl}/premium?subscribed=true`,
              cancel_url: `${baseUrl}/premium?cancelled=true`,
            },
          }),
        },
      );

      if (!subscriptionRes.ok) {
        let errorBody: unknown;
        try {
          errorBody = await subscriptionRes.json();
        } catch {
          errorBody = await subscriptionRes.text();
        }
        req.log.error(
          { status: subscriptionRes.status, paypalError: errorBody },
          "PayPal subscription creation failed",
        );
        res.status(500).json({
          error: "Payment error",
          message: "Failed to create subscription",
        });
        return;
      }

      const subscription = (await subscriptionRes.json()) as {
        id: string;
        status: string;
        links: Array<{ rel: string; href: string }>;
      };

      await db
        .insert(premiumSubscriptionsTable)
        .values({
          userId: user.id,
          paypalSubscriptionId: subscription.id,
          paypalPlanId: planId,
          status: "pending",
        })
        .onConflictDoNothing();

      await db
        .update(usersTable)
        .set({
          paypalSubscriptionId: subscription.id,
          subscriptionPlanId: planId,
          subscriptionStatus: "pending",
        })
        .where(eq(usersTable.id, user.id));

      const approvalLink = subscription.links?.find(
        (l) => l.rel === "approve",
      );

      res.json({
        subscriptionID: subscription.id,
        approvalUrl: approvalLink?.href ?? null,
      });
    } catch (err) {
      req.log.error({ err }, "Create subscription error");
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

router.post("/activate-subscription", requireAuth, async (req: AuthRequest, res) => {
  const user = req.user!;
  const { subscriptionID } = req.body as { subscriptionID?: string };

  if (!subscriptionID) {
    res.status(400).json({ error: "Bad request", message: "subscriptionID is required" });
    return;
  }

  try {
    const accessToken = await getPayPalAccessToken();
    const subRes = await fetch(
      `${PAYPAL_BASE_URL}/v1/billing/subscriptions/${subscriptionID}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    if (!subRes.ok) {
      let errBody: unknown;
      try { errBody = await subRes.json(); } catch { errBody = await subRes.text(); }
      req.log.error({ status: subRes.status, paypalError: errBody }, "PayPal subscription fetch failed");
      res.status(400).json({ error: "Invalid subscription" });
      return;
    }

    const subData = (await subRes.json()) as {
      id: string;
      status: string;
      custom_id?: string;
    };

    if (subData.custom_id !== String(user.id)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    if (subData.status === "ACTIVE") {
      const now = new Date();
      await db
        .update(usersTable)
        .set({
          isPremium: true,
          premiumActivatedAt: now,
          premiumSource: "paypal",
          paypalSubscriptionId: subscriptionID,
          subscriptionStatus: "active",
        })
        .where(eq(usersTable.id, user.id));

      await db
        .update(premiumSubscriptionsTable)
        .set({ status: "active", startTime: now, updatedAt: now })
        .where(
          eq(
            premiumSubscriptionsTable.paypalSubscriptionId,
            subscriptionID,
          ),
        );

      req.log.info(
        { userId: user.id, subscriptionID },
        "Premium subscription activated successfully",
      );

      res.json({ status: subData.status });
      return;
    }

    if (subData.status === "APPROVAL_PENDING") {
      req.log.info({ userId: user.id, subscriptionID }, "Subscription approval still pending after redirect — will activate via webhook");
      res.json({
        status: "APPROVAL_PENDING",
        message: "Awaiting PayPal approval — your subscription will activate once PayPal confirms it.",
      });
      return;
    }

    res.json({ status: subData.status });
  } catch (err) {
    req.log.error({ err }, "Activate subscription error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/cancel-subscription", requireAuth, async (req: AuthRequest, res) => {
  const user = req.user!;

  if (!user.paypalSubscriptionId) {
    res.status(400).json({ error: "No subscription", message: "You do not have an active subscription to cancel" });
    return;
  }

  if (user.subscriptionStatus !== "active") {
    res.status(400).json({ error: "Not active", message: "Your subscription is not active" });
    return;
  }

  try {
    const accessToken = await getPayPalAccessToken();

    const cancelRes = await fetch(
      `${PAYPAL_BASE_URL}/v1/billing/subscriptions/${user.paypalSubscriptionId}/cancel`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason: "Customer requested cancellation" }),
      },
    );

    if (!cancelRes.ok && cancelRes.status !== 422) {
      let errBody: unknown;
      try { errBody = await cancelRes.json(); } catch { errBody = await cancelRes.text(); }
      req.log.error({ status: cancelRes.status, paypalError: errBody }, "PayPal cancel subscription failed");
      res.status(500).json({ error: "Payment error", message: "Failed to cancel subscription with PayPal" });
      return;
    }

    const now = new Date();

    await db
      .update(usersTable)
      .set({ isPremium: false, subscriptionStatus: "cancelled" })
      .where(eq(usersTable.id, user.id));

    await db
      .update(premiumSubscriptionsTable)
      .set({ status: "cancelled", updatedAt: now })
      .where(eq(premiumSubscriptionsTable.paypalSubscriptionId, user.paypalSubscriptionId));

    req.log.info({ userId: user.id, subscriptionId: user.paypalSubscriptionId }, "Subscription cancelled by user");

    res.json({ success: true, message: "Subscription cancelled successfully" });
  } catch (err) {
    req.log.error({ err }, "Cancel subscription error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/webhook", async (req: Request, res) => {
  try {
    const accessToken = await getPayPalAccessToken();
    const verifyRes = await fetch(
      `${PAYPAL_BASE_URL}/v1/notifications/verify-webhook-signature`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          auth_algo: req.headers["paypal-auth-algo"],
          cert_url: req.headers["paypal-cert-url"],
          transmission_id: req.headers["paypal-transmission-id"],
          transmission_sig: req.headers["paypal-transmission-sig"],
          transmission_time: req.headers["paypal-transmission-time"],
          webhook_id: getPayPalWebhookId(),
          webhook_event: req.body,
        }),
      },
    );

    if (!verifyRes.ok) {
      let errBody: unknown;
      try { errBody = await verifyRes.json(); } catch { errBody = await verifyRes.text(); }
      req.log.warn(
        { status: verifyRes.status, paypalError: errBody },
        "Webhook verification request failed",
      );
      res.status(400).json({ error: "Verification failed" });
      return;
    }

    const verifyData = (await verifyRes.json()) as {
      verification_status: string;
    };
    if (verifyData.verification_status !== "SUCCESS") {
      req.log.warn("Webhook signature verification failed");
      res.status(400).json({ error: "Invalid signature" });
      return;
    }

    const webhookEvent = req.body as {
      event_type: string;
      resource: {
        id: string;
        custom_id?: string;
        billing_agreement_id?: string;
        status?: string;
        start_time?: string;
        amount?: { value: string; currency_code: string };
      };
    };

    const eventType = webhookEvent.event_type;
    req.log.info({ eventType }, "PayPal webhook received");

    switch (eventType) {
      case "BILLING.SUBSCRIPTION.CREATED": {
        const subId = webhookEvent.resource.id;
        const userId = webhookEvent.resource.custom_id
          ? parseInt(webhookEvent.resource.custom_id, 10)
          : null;
        req.log.info({ subId, userId }, "Subscription created event");
        break;
      }

      case "BILLING.SUBSCRIPTION.ACTIVATED": {
        const subId = webhookEvent.resource.id;
        const customId = webhookEvent.resource.custom_id;
        const userId = customId ? parseInt(customId, 10) : null;

        if (!userId) {
          const [sub] = await db
            .select()
            .from(premiumSubscriptionsTable)
            .where(eq(premiumSubscriptionsTable.paypalSubscriptionId, subId))
            .limit(1);
          if (sub) {
            if (sub.status === "active") {
              req.log.info({ subId, userId: sub.userId }, "Webhook duplicate: subscription already active, skipping");
              break;
            }
            await activateUserPremium(sub.userId, subId);
          }
        } else {
          const [existingUser] = await db
            .select({ isPremium: usersTable.isPremium, subscriptionStatus: usersTable.subscriptionStatus })
            .from(usersTable)
            .where(eq(usersTable.id, userId))
            .limit(1);

          if (existingUser?.isPremium && existingUser.subscriptionStatus === "active") {
            req.log.info({ subId, userId }, "Webhook duplicate: user already premium and active, skipping");
            break;
          }
          await activateUserPremium(userId, subId);
        }
        break;
      }

      case "BILLING.SUBSCRIPTION.CANCELLED":
      case "BILLING.SUBSCRIPTION.SUSPENDED":
      case "BILLING.SUBSCRIPTION.EXPIRED": {
        const subId = webhookEvent.resource.id;
        const statusMap: Record<string, string> = {
          "BILLING.SUBSCRIPTION.CANCELLED": "cancelled",
          "BILLING.SUBSCRIPTION.SUSPENDED": "suspended",
          "BILLING.SUBSCRIPTION.EXPIRED": "expired",
        };
        const newStatus = statusMap[eventType];

        const [sub] = await db
          .select()
          .from(premiumSubscriptionsTable)
          .where(eq(premiumSubscriptionsTable.paypalSubscriptionId, subId))
          .limit(1);

        if (sub) {
          if (sub.status === newStatus) {
            req.log.info({ subId, userId: sub.userId, status: newStatus }, "Webhook duplicate: subscription already in target state, skipping");
            break;
          }

          await db
            .update(premiumSubscriptionsTable)
            .set({ status: newStatus as any, updatedAt: new Date() })
            .where(eq(premiumSubscriptionsTable.paypalSubscriptionId, subId));

          await db
            .update(usersTable)
            .set({
              isPremium: false,
              subscriptionStatus: newStatus,
            })
            .where(eq(usersTable.id, sub.userId));

          req.log.info(
            { userId: sub.userId, subId, status: newStatus },
            "Subscription deactivated",
          );
        }
        break;
      }

      case "PAYMENT.SALE.COMPLETED": {
        const saleId = webhookEvent.resource.id;
        const billingAgreementId = webhookEvent.resource.billing_agreement_id;
        if (billingAgreementId) {
          const [sub] = await db
            .select()
            .from(premiumSubscriptionsTable)
            .where(
              eq(
                premiumSubscriptionsTable.paypalSubscriptionId,
                billingAgreementId,
              ),
            )
            .limit(1);

          if (sub) {
            if (saleId && sub.lastPaymentSaleId === saleId) {
              req.log.info({ saleId, subId: billingAgreementId, userId: sub.userId }, "Webhook duplicate: sale ID already recorded, skipping");
              break;
            }

            const now = new Date();

            await db
              .update(premiumSubscriptionsTable)
              .set({ lastPaymentAt: now, lastPaymentSaleId: saleId ?? null, updatedAt: now })
              .where(
                eq(
                  premiumSubscriptionsTable.paypalSubscriptionId,
                  billingAgreementId,
                ),
              );

            await db
              .update(usersTable)
              .set({
                lastPaymentAt: now,
                isPremium: true,
                subscriptionStatus: "active",
              })
              .where(eq(usersTable.id, sub.userId));

            req.log.info(
              { userId: sub.userId, subId: billingAgreementId, saleId },
              "Recurring payment completed",
            );
          }
        }
        break;
      }

      case "BILLING.SUBSCRIPTION.PAYMENT.FAILED": {
        const subId = webhookEvent.resource.billing_agreement_id || webhookEvent.resource.id;
        if (subId) {
          const [sub] = await db
            .select()
            .from(premiumSubscriptionsTable)
            .where(eq(premiumSubscriptionsTable.paypalSubscriptionId, subId))
            .limit(1);

          if (sub) {
            if (sub.status === "suspended") {
              req.log.info({ subId, userId: sub.userId }, "Webhook duplicate: subscription already suspended, skipping");
              break;
            }

            await db
              .update(premiumSubscriptionsTable)
              .set({ status: "suspended" as any, updatedAt: new Date() })
              .where(
                eq(premiumSubscriptionsTable.paypalSubscriptionId, subId),
              );

            await db
              .update(usersTable)
              .set({
                isPremium: false,
                subscriptionStatus: "suspended",
              })
              .where(eq(usersTable.id, sub.userId));

            req.log.info(
              { userId: sub.userId, subId },
              "Payment failed, premium suspended",
            );
          }
        }
        break;
      }

      default:
        req.log.info({ eventType }, "Unhandled webhook event type");
    }

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Webhook processing error");
    res.status(500).json({ error: "Internal server error" });
  }
});

async function activateUserPremium(
  userId: number,
  subscriptionId: string,
) {
  const now = new Date();

  await db
    .update(usersTable)
    .set({
      isPremium: true,
      premiumActivatedAt: now,
      premiumSource: "paypal",
      paypalSubscriptionId: subscriptionId,
      subscriptionStatus: "active",
    })
    .where(eq(usersTable.id, userId));

  await db
    .update(premiumSubscriptionsTable)
    .set({ status: "active", startTime: now, updatedAt: now })
    .where(
      eq(premiumSubscriptionsTable.paypalSubscriptionId, subscriptionId),
    );
}

export default router;
