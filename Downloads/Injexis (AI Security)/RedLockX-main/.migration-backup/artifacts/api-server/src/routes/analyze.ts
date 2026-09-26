import { Router } from "express";
import { db } from "@workspace/db";
import { analysisLogsTable } from "@workspace/db";
import { AnalyzePromptBody } from "@workspace/api-zod";
import { runAnalysis } from "../lib/analyze-engine";

const router = Router();

router.post("/analyze", async (req, res) => {
  const parsed = AnalyzePromptBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { prompt } = parsed.data;
  if (prompt.trim().length === 0) {
    res.status(400).json({ error: "Prompt cannot be empty" });
    return;
  }

  let result;
  try {
    result = await runAnalysis(prompt);
  } catch (err) {
    req.log.error({ err }, "HuggingFace Space call failed");
    res.status(502).json({
      error:
        "Unable to reach the detection models. The spaces may be sleeping — please try again in a few seconds.",
    });
    return;
  }

  try {
    const [inserted] = await db
      .insert(analysisLogsTable)
      .values({
        prompt,
        verdict: result.verdict,
        riskScore: result.riskScore,
        isSafe: result.isSafe,
        attackType: result.attackType,
        hybridProbability: result.hybridProbability,
        mlStatus: result.mlStatus,
        mlConfidence: result.mlConfidence,
        explanation: result.explanation,
      })
      .returning();

    if (!inserted) {
      res.status(500).json({ error: "Failed to store result" });
      return;
    }

    res.json({
      id: inserted.id,
      verdict: inserted.verdict,
      riskScore: inserted.riskScore,
      isSafe: inserted.isSafe,
      attackType: inserted.attackType,
      hybridProbability: inserted.hybridProbability,
      mlStatus: inserted.mlStatus,
      mlConfidence: inserted.mlConfidence,
      explanation: inserted.explanation,
      createdAt: inserted.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to store analysis result");
    res.status(500).json({ error: "Failed to store result" });
  }
});

export default router;
