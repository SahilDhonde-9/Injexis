import { Router } from "express";
import { getLlmSettings, saveLlmSettings } from "../lib/local-store";
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
    const s = getLlmSettings();
    if (!s) {
      res.status(404).json({ error: "No LLM settings configured" });
      return;
    }
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
    const saved = saveLlmSettings({ provider, apiKey, model, baseUrl: baseUrl ?? null });

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
