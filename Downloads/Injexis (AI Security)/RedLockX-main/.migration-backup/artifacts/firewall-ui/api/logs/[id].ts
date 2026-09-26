import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getPool } from "../_db";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const id = Number(req.query["id"]);
  if (!id || isNaN(id)) return res.status(400).json({ error: "Invalid log ID" });

  try {
    const pool = getPool();
    const { rows } = await pool.query("SELECT * FROM analysis_logs WHERE id = $1 LIMIT 1", [id]);
    if (!rows[0]) return res.status(404).json({ error: "Log not found" });
    const l = rows[0];
    return res.json({
      id: l.id, prompt: l.prompt, verdict: l.verdict, riskScore: l.risk_score,
      isSafe: l.is_safe, attackType: l.attack_type, hybridProbability: l.hybrid_probability,
      mlStatus: l.ml_status, mlConfidence: l.ml_confidence, explanation: l.explanation,
      createdAt: l.created_at,
    });
  } catch {
    return res.status(500).json({ error: "Failed to fetch log" });
  }
}
