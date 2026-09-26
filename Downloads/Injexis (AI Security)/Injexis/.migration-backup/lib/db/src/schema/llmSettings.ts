import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const llmSettingsTable = pgTable("llm_settings", {
  id: serial("id").primaryKey(),
  provider: text("provider").notNull(),
  apiKey: text("api_key").notNull(),
  model: text("model").notNull(),
  baseUrl: text("base_url"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertLlmSettingsSchema = createInsertSchema(llmSettingsTable).omit({ id: true, updatedAt: true });
export type InsertLlmSettings = z.infer<typeof insertLlmSettingsSchema>;
export type LlmSettings = typeof llmSettingsTable.$inferSelect;
