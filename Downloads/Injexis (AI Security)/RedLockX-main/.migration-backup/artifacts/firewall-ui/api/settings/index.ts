import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getPool } from "../_db";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const pool = getPool();

  if (req.method === "GET") {
    try {
      const { rows } = await pool.query("SELECT * FROM llm_settings LIMIT 1");
      if (!rows[0]) return res.status(404).json({ error: "No LLM settings configured" });
      const s = rows[0];
      return res.json({ provider: s.provider, model: s.model, hasApiKey: s.api_key?.length > 0, baseUrl: s.base_url ?? null });
    } catch { return res.status(500).json({ error: "Failed to retrieve settings" }); }
  }

  if (req.method === "POST") {
    const { provider, apiKey, model, baseUrl } = req.body ?? {};
    if (!provider || !apiKey || !model) return res.status(400).json({ error: "provider, apiKey, and model are required" });
    try {
      const existing = await pool.query("SELECT id FROM llm_settings LIMIT 1");
      let saved;
      if (existing.rows[0]) {
        const { rows } = await pool.query(`UPDATE llm_settings SET provider=$1,api_key=$2,model=$3,base_url=$4,updated_at=now() WHERE id=$5 RETURNING *`, [provider, apiKey, model, baseUrl ?? null, existing.rows[0].id]);
        saved = rows[0];
      } else {
        const { rows } = await pool.query(`INSERT INTO llm_settings (provider,api_key,model,base_url) VALUES ($1,$2,$3,$4) RETURNING *`, [provider, apiKey, model, baseUrl ?? null]);
        saved = rows[0];
      }
      return res.json({ provider: saved.provider, model: saved.model, hasApiKey: true, baseUrl: saved.base_url ?? null });
    } catch { return res.status(500).json({ error: "Failed to save settings" }); }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
