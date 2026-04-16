import { pgTable, serial, integer, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const surveyResponsesTable = pgTable("survey_responses", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  answers: jsonb("answers").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type SurveyResponse = typeof surveyResponsesTable.$inferSelect;
export type InsertSurveyResponse = typeof surveyResponsesTable.$inferInsert;
