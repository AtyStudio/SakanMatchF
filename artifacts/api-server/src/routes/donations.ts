import { Router } from "express";
import { logger } from "../lib/logger";

const router = Router();

const PAYPAL_BASE_URL = "https://api-m.sandbox.paypal.com";

{
  const missing = (["PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET"] as const).filter(
    (key) => !process.env[key],
  );
  if (missing.length > 0) {
    logger.warn({ missingVars: missing }, "PayPal credential(s) missing — donation features will not work");
  } else {
    logger.info("PayPal credentials present — donation features available");
  }
}

async function getPayPalAccessToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("PayPal credentials are not configured");
  }
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
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

router.get("/config", (_req, res) => {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  if (!clientId) {
    res.status(503).json({ error: "PayPal not configured" });
    return;
  }
  res.json({ clientId });
});

router.post("/create", async (req, res) => {
  const { amount } = req.body as { amount?: number };

  if (!amount || typeof amount !== "number" || amount <= 0) {
    res.status(400).json({ error: "Bad request", message: "amount must be a positive number" });
    return;
  }

  const amountStr = amount.toFixed(2);

  try {
    const accessToken = await getPayPalAccessToken();

    const orderRes = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            description: "Donation to SakanMatch",
            amount: {
              currency_code: "USD",
              value: amountStr,
            },
          },
        ],
        application_context: {
          brand_name: "SakanMatch",
          shipping_preference: "NO_SHIPPING",
          user_action: "PAY_NOW",
        },
      }),
    });

    if (!orderRes.ok) {
      let errBody: unknown;
      try { errBody = await orderRes.json(); } catch { errBody = await orderRes.text(); }
      req.log?.error({ status: orderRes.status, paypalError: errBody }, "PayPal create order failed");
      res.status(500).json({ error: "Payment error", message: "Failed to create PayPal order" });
      return;
    }

    const order = (await orderRes.json()) as { id: string; status: string };
    res.json({ orderID: order.id });
  } catch (err) {
    req.log?.error({ err }, "Create donation order error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/capture", async (req, res) => {
  const { orderID } = req.body as { orderID?: string };

  if (!orderID) {
    res.status(400).json({ error: "Bad request", message: "orderID is required" });
    return;
  }

  try {
    const accessToken = await getPayPalAccessToken();

    const captureRes = await fetch(
      `${PAYPAL_BASE_URL}/v2/checkout/orders/${orderID}/capture`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (!captureRes.ok) {
      let errBody: unknown;
      try { errBody = await captureRes.json(); } catch { errBody = await captureRes.text(); }
      req.log?.error({ status: captureRes.status, paypalError: errBody }, "PayPal capture order failed");
      res.status(500).json({ error: "Payment error", message: "Failed to capture donation" });
      return;
    }

    const capture = (await captureRes.json()) as { status: string };
    req.log?.info({ orderID, status: capture.status }, "Donation captured successfully");
    res.json({ status: capture.status });
  } catch (err) {
    req.log?.error({ err }, "Capture donation error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
