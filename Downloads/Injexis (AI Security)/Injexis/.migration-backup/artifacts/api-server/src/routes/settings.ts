import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { llmSettingsTable } from "@workspace/db";
import { z } from "zod";

const router = Router();

const LlmSettingsInputSchema = z.object({
  provider: z.enum(["openai", "groq", "gemini", "custom"]),
  apiKey: z.string().min(1, "API key is required"),
  model: z.string().min(1, "Model is required"),
  baseUrl: z.string().nullable().optional(),
});

router.get("/settings", async (req, res) => {
  try {
    const rows = await db.select().from(llmSettingsTable).limit(1);
    if (rows.length === 0) {
      res.status(404).json({ error: "No LLM settings configured" });
      return;
    }
    const s = rows[0]!;
    res.json({
      provider: s.provider,
      model: s.model,
      hasApiKey: s.apiKey.length > 0,
      baseUrl: s.baseUrl ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get settings");
    res.status(500).json({ error: "Failed to retrieve settings" });
  }
});

router.post("/settings", async (req, res) => {
  const parsed = LlmSettingsInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid input" });
    return;
  }

  const { provider, apiKey, model, baseUrl } = parsed.data;

  try {
    const existing = await db
      .select({ id: llmSettingsTable.id })
      .from(llmSettingsTable)
      .limit(1);

    let saved;
    if (existing.length > 0 && existing[0]) {
      const [updated] = await db
        .update(llmSettingsTable)
        .set({ provider, apiKey, model, baseUrl: baseUrl ?? null, updatedAt: new Date() })
        .where(eq(llmSettingsTable.id, existing[0].id))
        .returning();
      saved = updated;
    } else {
      const [inserted] = await db
        .insert(llmSettingsTable)
        .values({ provider, apiKey, model, baseUrl: baseUrl ?? null })
        .returning();
      saved = inserted;
    }

    if (!saved) {
      res.status(500).json({ error: "Failed to save settings" });
      return;
    }

    res.json({
      provider: saved.provider,
      model: saved.model,
      hasApiKey: true,
      baseUrl: saved.baseUrl ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to save settings");
    res.status(500).json({ error: "Failed to save settings" });
  }
});

export default router;
