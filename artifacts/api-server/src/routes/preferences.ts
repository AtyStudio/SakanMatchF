import { Router } from "express";
import { db, userPreferencesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, type AuthRequest } from "../middlewares/auth";

const router = Router();

const preferencesSchema = z.object({
  city: z.string().optional().nullable(),
  budgetMin: z.number().optional().nullable(),
  budgetMax: z.number().optional().nullable(),
  lifestyle: z.enum(["quiet", "social", "any"]).optional(),
  smoking: z.enum(["yes", "no", "any"]).optional(),
  genderPref: z.enum(["male", "female", "any"]).optional(),
});

router.get("/", requireAuth, async (req: AuthRequest, res) => {
  if (req.user!.role !== "seeker") {
    res.status(403).json({ error: "Only seekers have preferences" });
    return;
  }
  try {
    const [pref] = await db
      .select()
      .from(userPreferencesTable)
      .where(eq(userPreferencesTable.userId, req.user!.id))
      .limit(1);

    res.json(pref || null);
  } catch (err) {
    req.log.error({ err }, "Get preferences error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/", requireAuth, async (req: AuthRequest, res) => {
  if (req.user!.role !== "seeker") {
    res.status(403).json({ error: "Only seekers can set preferences" });
    return;
  }
  const result = preferencesSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: "Validation error", message: result.error.message });
    return;
  }

  const data = result.data;

  try {
    const existing = await db
      .select({ id: userPreferencesTable.id })
      .from(userPreferencesTable)
      .where(eq(userPreferencesTable.userId, req.user!.id))
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await db
        .update(userPreferencesTable)
        .set({
          city: data.city ?? null,
          budgetMin: data.budgetMin?.toString() ?? null,
          budgetMax: data.budgetMax?.toString() ?? null,
          lifestyle: data.lifestyle ?? "any",
          smoking: data.smoking ?? "any",
          genderPref: data.genderPref ?? "any",
          updatedAt: new Date(),
        })
        .where(eq(userPreferencesTable.userId, req.user!.id))
        .returning();
      res.json(updated);
    } else {
      const [created] = await db
        .insert(userPreferencesTable)
        .values({
          userId: req.user!.id,
          city: data.city ?? null,
          budgetMin: data.budgetMin?.toString() ?? null,
          budgetMax: data.budgetMax?.toString() ?? null,
          lifestyle: data.lifestyle ?? "any",
          smoking: data.smoking ?? "any",
          genderPref: data.genderPref ?? "any",
        })
        .returning();
      res.status(201).json(created);
    }
  } catch (err) {
    req.log.error({ err }, "Update preferences error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
