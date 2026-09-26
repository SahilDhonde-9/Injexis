import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getPool } from "../_db";

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT to_char(created_at::date,'YYYY-MM-DD') as date, count(*)::int as analyzed, sum(case when verdict='BLOCK' then 1 else 0 end)::int as blocked, sum(case when verdict='ALLOW' then 1 else 0 end)::int as allowed FROM analysis_logs WHERE created_at >= now() - interval '7 days' GROUP BY created_at::date ORDER BY created_at::date ASC`
    );
    return res.json(rows);
  } catch {
    return res.status(500).json({ error: "Failed to fetch recent activity" });
  }
}
