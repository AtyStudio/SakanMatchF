import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth";

const router = Router();

router.get("/status", requireAuth, async (req: AuthRequest, res) => {
  try {
    const [user] = await db
      .select({
        isPremium: usersTable.isPremium,
        premiumActivatedAt: usersTable.premiumActivatedAt,
        premiumSource: usersTable.premiumSource,
        subscriptionStatus: usersTable.subscriptionStatus,
        paypalSubscriptionId: usersTable.paypalSubscriptionId,
        lastPaymentAt: usersTable.lastPaymentAt,
      })
      .from(usersTable)
      .where(eq(usersTable.id, req.user!.id))
      .limit(1);

    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    res.json({
      isPremium: user.isPremium,
      premiumActivatedAt: user.premiumActivatedAt?.toISOString() ?? null,
      premiumSource: user.premiumSource ?? null,
      subscriptionStatus: user.subscriptionStatus ?? null,
      paypalSubscriptionId: user.paypalSubscriptionId ?? null,
      lastPaymentAt: user.lastPaymentAt?.toISOString() ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Premium status error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
