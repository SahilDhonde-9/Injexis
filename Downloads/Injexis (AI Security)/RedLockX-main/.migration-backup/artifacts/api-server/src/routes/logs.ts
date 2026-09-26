import { Router } from "express";
import { db } from "@workspace/db";
import { analysisLogsTable } from "@workspace/db";
import { desc, eq, count } from "drizzle-orm";
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
    const baseQuery = db.select().from(analysisLogsTable);
    const baseCount = db.select({ count: count() }).from(analysisLogsTable);

    const [logs, [totalRow]] = await Promise.all([
      (verdict
        ? baseQuery.where(eq(analysisLogsTable.verdict, verdict))
        : baseQuery
      )
        .orderBy(desc(analysisLogsTable.createdAt))
        .limit(limit ?? 50)
        .offset(offset ?? 0),
      verdict
        ? baseCount.where(eq(analysisLogsTable.verdict, verdict))
        : baseCount,
    ]);

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
        createdAt: l.createdAt.toISOString(),
      })),
      total: totalRow?.count ?? 0,
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
    const [log] = await db
      .select()
      .from(analysisLogsTable)
      .where(eq(analysisLogsTable.id, parsed.data.id))
      .limit(1);

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
      createdAt: log.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch log");
    res.status(500).json({ error: "Failed to fetch log" });
  }
});

export default router;
