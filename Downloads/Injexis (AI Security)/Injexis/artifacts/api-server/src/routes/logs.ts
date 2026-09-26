import { Router } from "express";
import { getAnalysisLogs, getAnalysisLogById } from "../lib/local-store";
import { GetLogsQueryParams, GetLogByIdParams } from "@workspace/api-zod";

const router = Router();

router.get("/logs", async (req, res) => {
  const parsed = GetLogsQueryParams.safeParse({
    limit: req.query["limit"] ? Number(req.query["limit"]) : 50,
    offset: req.query["offset"] ? Number(req.query["offset"]) : 0,
    verdict: req.query["verdict"] ?? undefined,
  });

  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query parameters" });
    return;
  }

  const { limit, offset, verdict } = parsed.data;

  try {
    const { logs, total } = getAnalysisLogs({ limit: limit ?? 50, offset: offset ?? 0, verdict });

    res.json({
      logs: logs.map((l) => ({
        id: l.id,
        prompt: l.prompt,
        verdict: l.verdict,
        riskScore: l.riskScore,
        isSafe: l.isSafe,
        attackType: l.attackType,
        hybridProbability: l.hybridProbability,
        mlStatus: l.mlStatus,
        mlConfidence: l.mlConfidence,
        createdAt: l.createdAt,
      })),
      total,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch logs");
    res.status(500).json({ error: "Failed to fetch logs" });
  }
});

router.get("/logs/:id", async (req, res) => {
  const parsed = GetLogByIdParams.safeParse({ id: Number(req.params["id"]) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid log ID" });
    return;
  }

  try {
    const log = getAnalysisLogById(parsed.data.id);

    if (!log) {
      res.status(404).json({ error: "Log not found" });
      return;
    }

    res.json({
      id: log.id,
      prompt: log.prompt,
      verdict: log.verdict,
      riskScore: log.riskScore,
      isSafe: log.isSafe,
      attackType: log.attackType,
      hybridProbability: log.hybridProbability,
      mlStatus: log.mlStatus,
      mlConfidence: log.mlConfidence,
      explanation: log.explanation,
      createdAt: log.createdAt,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch log");
    res.status(500).json({ error: "Failed to fetch log" });
  }
});

export default router;
