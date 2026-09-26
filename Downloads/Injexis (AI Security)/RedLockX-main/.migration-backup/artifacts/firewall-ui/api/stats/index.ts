import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getPool } from "../_db";

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const pool = getPool();
    const today = new Date(); today.setHours(0, 0, 0, 0);

    const [overall, todayRows] = await Promise.all([
      pool.query(`SELECT count(*) as total_analyzed, sum(case when verdict='BLOCK' then 1 else 0 end)::int as total_blocked, sum(case when verdict='ALLOW' then 1 else 0 end)::int as total_allowed, avg(risk_score) as avg_risk FROM analysis_logs`),
      pool.query(`SELECT count(*) as today_analyzed, sum(case when verdict='BLOCK' then 1 else 0 end)::int as today_blocked FROM analysis_logs WHERE created_at >= $1`, [today.toISOString()]),
    ]);

    const r = overall.rows[0];
    const t = todayRows.rows[0];
    const totalAnalyzed = Number(r.total_analyzed) || 0;
    const totalBlocked = Number(r.total_blocked) || 0;
    const totalAllowed = Number(r.total_allowed) || 0;
    const blockRate = totalAnalyzed > 0 ? (totalBlocked / totalAnalyzed) * 100 : 0;

    return res.json({
      totalAnalyzed, totalBlocked, totalAllowed,
      blockRate: Number(blockRate.toFixed(2)),
      avgRiskScore: Number(Number(r.avg_risk ?? 0).toFixed(2)),
      todayAnalyzed: Number(t.today_analyzed) || 0,
      todayBlocked: Number(t.today_blocked) || 0,
    });
  } catch {
    return res.status(500).json({ error: "Failed to fetch stats" });
  }
}
