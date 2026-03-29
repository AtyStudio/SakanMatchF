import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db, usersTable, premiumSubscriptionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

export interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
    role: string;
    isPremium: boolean;
    paypalSubscriptionId: string | null;
    subscriptionStatus: string | null;
  };
}

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required");
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized", message: "No token provided" });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET!) as { userId: number };
    db.select()
      .from(usersTable)
      .where(eq(usersTable.id, payload.userId))
      .limit(1)
      .then(async ([user]) => {
        if (!user) {
          res.status(401).json({ error: "Unauthorized", message: "User not found" });
          return;
        }

        let isPremium = user.isPremium;

        if (user.isPremium) {
          const [activeSub] = await db
            .select({ id: premiumSubscriptionsTable.id })
            .from(premiumSubscriptionsTable)
            .where(
              and(
                eq(premiumSubscriptionsTable.userId, user.id),
                eq(premiumSubscriptionsTable.status, "active"),
              ),
            )
            .limit(1);

          if (!activeSub) {
            req.log?.warn(
              { userId: user.id },
              "User has isPremium=true in DB but no active subscription row — treating as non-premium",
            );
            isPremium = false;
          }
        }

        req.user = {
          id: user.id,
          email: user.email,
          role: user.role,
          isPremium,
          paypalSubscriptionId: user.paypalSubscriptionId ?? null,
          subscriptionStatus: user.subscriptionStatus ?? null,
        };
        next();
      })
      .catch((err) => {
        req.log.error({ err }, "Error looking up user");
        res.status(500).json({ error: "Internal server error" });
      });
  } catch {
    res.status(401).json({ error: "Unauthorized", message: "Invalid or expired token" });
  }
}

export function requireOwner(req: AuthRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (req.user.role !== "owner") {
    res.status(403).json({ error: "Forbidden", message: "Owner account required" });
    return;
  }
  next();
}

export function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    next();
    return;
  }
  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET!) as { userId: number };
    req.user = { id: payload.userId, email: "", role: "", isPremium: false, paypalSubscriptionId: null, subscriptionStatus: null };
  } catch {
  }
  next();
}
