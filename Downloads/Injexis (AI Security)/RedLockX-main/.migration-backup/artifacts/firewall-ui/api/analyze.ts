import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getPool } from "./_db";
import { runAnalysis } from "./_analyze";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { prompt } = req.body ?? {};
  if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
    return res.status(400).json({ error: "Prompt is required" });
  }

  let result;
  try {
    result = await runAnalysis(prompt);
  } catch {
    return res.status(502).json({ error: "Unable to reach detection models — please try again in a few seconds." });
  }

  try {
    const pool = getPool();
    const { rows } = await pool.query(
      `INSERT INTO analysis_logs (prompt, verdict, risk_score, is_safe, attack_type, hybrid_probability, ml_status, ml_confidence, explanation)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [prompt, result.verdict, result.riskScore, result.isSafe, result.attackType, result.hybridProbability, result.mlStatus, result.mlConfidence, result.explanation]
    );
    const row = rows[0];
    return res.json({
      id: row.id, verdict: row.verdict, riskScore: row.risk_score, isSafe: row.is_safe,
      attackType: row.attack_type, hybridProbability: row.hybrid_probability,
      mlStatus: row.ml_status, mlConfidence: row.ml_confidence,
      explanation: row.explanation, createdAt: row.created_at,
    });
  } catch {
    return res.status(500).json({ error: "Failed to store result" });
  }
}
