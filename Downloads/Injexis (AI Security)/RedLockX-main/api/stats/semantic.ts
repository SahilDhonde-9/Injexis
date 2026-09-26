import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getPool } from "../_db";

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const pool = getPool();

    const [sanitizedRows, semanticBlockRows, totalChatRows] = await Promise.all([
      // Messages where the adversarial part was removed but the legitimate part still answered
      pool.query(`SELECT count(*)::int as count FROM chat_messages WHERE verdict = 'SANITIZED'`),
      // Prompts that Hybrid+ML alone missed but semantic intent analysis caught
      pool.query(`SELECT count(*)::int as count FROM analysis_logs WHERE attack_type = 'harmful_intent'`),
      // Total user turns in chat, to compute a "re-verified" rate
      pool.query(`SELECT count(*)::int as count FROM chat_messages WHERE role = 'user'`),
    ]);

    const sanitizedCount = sanitizedRows.rows[0]?.count ?? 0;
    const semanticBlockCount = semanticBlockRows.rows[0]?.count ?? 0;
    const totalChatTurns = totalChatRows.rows[0]?.count ?? 0;

    return res.json({
      sanitizedCount,
      semanticBlockCount,
      totalChatTurns,
    });
  } catch {
    return res.status(500).json({ error: "Failed to fetch semantic stats" });
  }
}