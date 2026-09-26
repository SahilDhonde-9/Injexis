import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getPool } from "../_db";

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT attack_type as "attackType", count(*)::int as count FROM analysis_logs WHERE is_safe = false AND attack_type IS NOT NULL GROUP BY attack_type ORDER BY count(*) DESC`
    );
    return res.json(rows);
  } catch {
    return res.status(500).json({ error: "Failed to fetch attack types" });
  }
}
