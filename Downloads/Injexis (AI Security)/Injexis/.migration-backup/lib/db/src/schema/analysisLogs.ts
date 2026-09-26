import { pgTable, serial, text, real, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const analysisLogsTable = pgTable("analysis_logs", {
  id: serial("id").primaryKey(),
  prompt: text("prompt").notNull(),
  verdict: text("verdict").notNull(),
  riskScore: real("risk_score").notNull(),
  isSafe: boolean("is_safe").notNull(),
  attackType: text("attack_type"),
  hybridProbability: real("hybrid_probability").notNull(),
  mlStatus: text("ml_status").notNull(),
  mlConfidence: real("ml_confidence").notNull(),
  explanation: text("explanation").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAnalysisLogSchema = createInsertSchema(analysisLogsTable).omit({ id: true, createdAt: true });
export type InsertAnalysisLog = z.infer<typeof insertAnalysisLogSchema>;
export type AnalysisLog = typeof analysisLogsTable.$inferSelect;
