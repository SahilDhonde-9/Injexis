import { Router } from "express";
import { db } from "@workspace/db";
import { analysisLogsTable } from "@workspace/db";
import { eq, count, avg, sql } from "drizzle-orm";

const router = Router();

router.get("/stats", async (_req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [overall, todayRows] = await Promise.all([
      db
        .select({
          totalAnalyzed: count(),
          totalBlocked: sql<number>`sum(case when verdict = 'BLOCK' then 1 else 0 end)::int`,
          totalAllowed: sql<number>`sum(case when verdict = 'ALLOW' then 1 else 0 end)::int`,
          avgRiskScore: avg(analysisLogsTable.riskScore),
        })
        .from(analysisLogsTable),
      db
        .select({
          todayAnalyzed: count(),
          todayBlocked: sql<number>`sum(case when verdict = 'BLOCK' then 1 else 0 end)::int`,
        })
        .from(analysisLogsTable)
        .where(sql`created_at >= ${today.toISOString()}`),
    ]);

    const row = overall[0]!;
    const todayRow = todayRows[0]!;
    const totalAnalyzed = row.totalAnalyzed ?? 0;
    const totalBlocked = Number(row.totalBlocked) || 0;
    const totalAllowed = Number(row.totalAllowed) || 0;
    const blockRate = totalAnalyzed > 0 ? (totalBlocked / totalAnalyzed) * 100 : 0;

    res.json({
      totalAnalyzed,
      totalBlocked,
      totalAllowed,
      blockRate: Number(blockRate.toFixed(2)),
      avgRiskScore: Number(Number(row.avgRiskScore ?? 0).toFixed(2)),
      todayAnalyzed: Number(todayRow.todayAnalyzed) || 0,
      todayBlocked: Number(todayRow.todayBlocked) || 0,
    });
  } catch (err) {
    _req.log.error({ err }, "Failed to fetch stats");
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

router.get("/stats/attack-types", async (_req, res) => {
  try {
    const rows = await db
      .select({
        attackType: analysisLogsTable.attackType,
        count: count(),
      })
      .from(analysisLogsTable)
      .where(eq(analysisLogsTable.isSafe, false))
      .groupBy(analysisLogsTable.attackType)
      .orderBy(sql`count(*) desc`);

    res.json(
      rows
        .filter((r) => r.attackType !== null)
        .map((r) => ({ attackType: r.attackType!, count: r.count }))
    );
  } catch (err) {
    _req.log.error({ err }, "Failed to fetch attack types");
    res.status(500).json({ error: "Failed to fetch attack types" });
  }
});

router.get("/stats/recent-activity", async (_req, res) => {
  try {
    const rows = await db.execute(sql`
      SELECT
        to_char(created_at::date, 'YYYY-MM-DD') as date,
        count(*)::int as analyzed,
        sum(case when verdict = 'BLOCK' then 1 else 0 end)::int as blocked,
        sum(case when verdict = 'ALLOW' then 1 else 0 end)::int as allowed
      FROM analysis_logs
      WHERE created_at >= now() - interval '7 days'
      GROUP BY created_at::date
      ORDER BY created_at::date ASC
    `);

    res.json(
      (rows.rows as Array<{ date: string; analyzed: number; blocked: number; allowed: number }>).map(
        (r) => ({
          date: r.date,
          analyzed: r.analyzed,
          blocked: r.blocked,
          allowed: r.allowed,
        })
      )
    );
  } catch (err) {
    _req.log.error({ err }, "Failed to fetch recent activity");
    res.status(500).json({ error: "Failed to fetch recent activity" });
  }
});

export default router;
