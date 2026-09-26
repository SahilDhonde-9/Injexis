import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getPool } from "../_db";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const limit = Math.min(100, Number(req.query["limit"]) || 50);
  const offset = Number(req.query["offset"]) || 0;
  const verdict = req.query["verdict"] as string | undefined;

  try {
    const pool = getPool();
    const params: unknown[] = [limit, offset];
    const where = verdict ? `WHERE verdict = $3` : "";
    if (verdict) params.push(verdict);

    const [logsRes, countRes] = await Promise.all([
      pool.query(`SELECT * FROM analysis_logs ${where} ORDER BY created_at DESC LIMIT $1 OFFSET $2`, params),
      pool.query(`SELECT count(*)::int as total FROM analysis_logs ${where}`, verdict ? [verdict] : []),
    ]);

    return res.json({
      logs: logsRes.rows.map((l) => ({
        id: l.id, prompt: l.prompt, verdict: l.verdict, riskScore: l.risk_score,
        isSafe: l.is_safe, attackType: l.attack_type, hybridProbability: l.hybrid_probability,
        mlStatus: l.ml_status, mlConfidence: l.ml_confidence, explanation: l.explanation,
        createdAt: l.created_at,
      })),
      total: countRes.rows[0]?.total ?? 0,
    });
  } catch {
    return res.status(500).json({ error: "Failed to fetch logs" });
  }
}
