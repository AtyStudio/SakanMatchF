import { Router } from "express";
import { z } from "zod";
import { db, usersTable, surveyResponsesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { sendMail } from "../lib/mailer";

const router = Router();

const surveySchema = z.object({
  age: z.enum(["under18", "18-24", "25-34", "35-44", "45+"]),
  status: z.enum(["student", "employed", "self-employed", "unemployed", "other"]),
  hasRented: z.enum(["yes", "no"]),
  rentalFrequency: z.enum(["rarely", "1-2-times", "several-times", "very-often"]).optional(),
  stayType: z.enum(["vacation", "studies", "work", "long-term", "other"]),
  problems: z.array(z.enum(["high-prices", "lack-of-trust", "poor-quality", "booking-difficulty", "other"])),
  importantCriteria: z.array(z.enum(["price", "location", "safety", "cleanliness", "reviews", "ease-of-use"])),
  interestedInApp: z.enum(["yes", "no", "maybe"]),
  preferredPayment: z.enum(["online", "cash", "both"]),
  wantToSee: z.string().max(1000).optional(),
  suggestions: z.string().max(1000).optional(),
  email: z.string().email(),
});

type SurveyAnswers = z.infer<typeof surveySchema>;

function formatAnswersHtml(answers: SurveyAnswers): string {
  const labelMap: Record<string, Record<string, string>> = {
    age: { under18: "Under 18", "18-24": "18–24", "25-34": "25–34", "35-44": "35–44", "45+": "45+" },
    status: { student: "Student", employed: "Employed", "self-employed": "Self-employed", unemployed: "Unemployed", other: "Other" },
    hasRented: { yes: "Yes", no: "No" },
    rentalFrequency: { rarely: "Rarely", "1-2-times": "1–2 times per year", "several-times": "Several times per year", "very-often": "Very often" },
    stayType: { vacation: "Vacation", studies: "Studies", work: "Work", "long-term": "Long-term", other: "Other" },
    problems: { "high-prices": "High prices", "lack-of-trust": "Lack of trust", "poor-quality": "Poor quality", "booking-difficulty": "Booking difficulty", other: "Other" },
    importantCriteria: { price: "Price", location: "Location", safety: "Safety", cleanliness: "Cleanliness", reviews: "Reviews", "ease-of-use": "Ease of use" },
    interestedInApp: { yes: "Yes", no: "No", maybe: "Maybe" },
    preferredPayment: { online: "Online", cash: "Cash", both: "Both" },
  };

  const rows: [string, string][] = [
    ["Age", labelMap.age[answers.age] || answers.age],
    ["Status", labelMap.status[answers.status] || answers.status],
    ["Have you ever rented?", labelMap.hasRented[answers.hasRented]],
    ...(answers.rentalFrequency ? [["How often?", labelMap.rentalFrequency[answers.rentalFrequency] || answers.rentalFrequency] as [string, string]] : []),
    ["Type of stay", labelMap.stayType[answers.stayType] || answers.stayType],
    ["Problems encountered", (answers.problems.map(p => labelMap.problems[p] || p)).join(", ") || "None"],
    ["Important criteria", (answers.importantCriteria.map(c => labelMap.importantCriteria[c] || c)).join(", ") || "None"],
    ["Interested in new app?", labelMap.interestedInApp[answers.interestedInApp]],
    ["Preferred payment", labelMap.preferredPayment[answers.preferredPayment]],
    ["What to see in app", answers.wantToSee || "—"],
    ["Suggestions", answers.suggestions || "—"],
    ["Email", answers.email],
  ];

  const tableRows = rows.map(([label, value]) =>
    `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:600;color:#374151;white-space:nowrap;vertical-align:top">${label}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;color:#6b7280;vertical-align:top">${value}</td>
    </tr>`
  ).join("\n");

  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:sans-serif;background:#f9fafb;margin:0;padding:24px">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
    <div style="background:linear-gradient(135deg,#c97b3f,#e6a84b);padding:24px 32px">
      <h1 style="color:#fff;margin:0;font-size:20px">📋 New Survey Submission</h1>
      <p style="color:rgba(255,255,255,0.85);margin:6px 0 0;font-size:14px">SakanMatch — Roommate Platform</p>
    </div>
    <div style="padding:24px 32px">
      <table style="width:100%;border-collapse:collapse">
        <tbody>${tableRows}</tbody>
      </table>
    </div>
    <div style="padding:16px 32px 24px;background:#f9fafb;border-top:1px solid #e5e7eb">
      <p style="margin:0;font-size:12px;color:#9ca3af">Submitted via SakanMatch survey form</p>
    </div>
  </div>
</body>
</html>`;
}

router.post("/survey", requireAuth, async (req: AuthRequest, res) => {
  const result = surveySchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: "Validation error", message: result.error.message });
    return;
  }

  const answers = result.data;
  const userId = req.user!.id;

  try {
    await db.insert(surveyResponsesTable).values({
      userId,
      email: answers.email,
      answers: answers as unknown as Record<string, unknown>,
    });

    await db
      .update(usersTable)
      .set({ hasCompletedSurvey: true })
      .where(eq(usersTable.id, userId));

    const recipientEmail = process.env.SURVEY_RECIPIENT_EMAIL || "contact@sakanmatch.site";
    sendMail({
      to: recipientEmail,
      subject: "New Survey Submission – SakanMatch",
      html: formatAnswersHtml(answers),
    }).catch(err => req.log?.error({ err }, "Failed to send survey email"));

    res.json({ success: true });
  } catch (err) {
    req.log?.error({ err }, "Survey submission error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/survey/skip", requireAuth, async (req: AuthRequest, res) => {
  res.json({ success: true, skipped: true });
});

export default router;
