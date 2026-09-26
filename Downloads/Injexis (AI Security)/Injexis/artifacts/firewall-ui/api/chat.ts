import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getPool } from "./_db";
import { runAnalysis } from "./_analyze";

function makeSessionId() { return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`; }

async function callLlm(settings: Record<string, string>, history: Array<{ role: string; content: string }>, userMessage: string): Promise<string> {
  const provider = settings.provider;
  if (provider === "gemini") {
    const contents = [
      ...history.filter((m) => m.role !== "system").map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
      { role: "user", parts: [{ text: userMessage }] },
    ];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${settings.model}:generateContent?key=${settings.api_key}`;
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents, generationConfig: { maxOutputTokens: 1500, temperature: 0.7 } }), signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`Gemini API error ${res.status}`);
    const data = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "(no response)";
  }
  const baseUrl = provider === "openai" ? "https://api.openai.com/v1" : provider === "groq" ? "https://api.groq.com/openai/v1" : settings.base_url ?? "https://api.openai.com/v1";
  const messages = [{ role: "system", content: "You are a helpful AI assistant. This conversation is monitored by a prompt injection firewall." }, ...history.map((m) => ({ role: m.role, content: m.content })), { role: "user", content: userMessage }];
  const res = await fetch(`${baseUrl}/chat/completions`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${settings.api_key}` }, body: JSON.stringify({ model: settings.model, messages, max_tokens: 1500, temperature: 0.7 }), signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`LLM API error ${res.status}`);
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content ?? "(no response)";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { message, history = [], sessionId: incomingSession } = req.body ?? {};
  if (!message || typeof message !== "string") return res.status(400).json({ error: "message is required" });
  const sessionId = incomingSession ?? makeSessionId();
  const pool = getPool();

  const settingsRows = await pool.query("SELECT * FROM llm_settings LIMIT 1");
  if (settingsRows.rows.length === 0) return res.status(503).json({ error: "No LLM configured. Add your API key in Settings first." });
  const settings = settingsRows.rows[0];

  let analysis;
  try { analysis = await runAnalysis(message); }
  catch { return res.status(502).json({ error: "Detection models unavailable — try again shortly." }); }

  let logId = 0;
  try {
    const { rows } = await pool.query(`INSERT INTO analysis_logs (prompt,verdict,risk_score,is_safe,attack_type,hybrid_probability,ml_status,ml_confidence,explanation) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`, [message, analysis.verdict, analysis.riskScore, analysis.isSafe, analysis.attackType, analysis.hybridProbability, analysis.mlStatus, analysis.mlConfidence, analysis.explanation]);
    logId = rows[0]?.id ?? 0;
  } catch {}

  const analysisResult = { id: logId, verdict: analysis.verdict, riskScore: analysis.riskScore, isSafe: analysis.isSafe, attackType: analysis.attackType, hybridProbability: analysis.hybridProbability, mlStatus: analysis.mlStatus, mlConfidence: analysis.mlConfidence, explanation: analysis.explanation, createdAt: new Date().toISOString() };

  if (analysis.verdict === "BLOCK") {
    try { await pool.query(`INSERT INTO chat_messages (session_id,role,content,verdict,risk_score,is_blocked,blocked_reason) VALUES ($1,'user',$2,'BLOCK',$3,true,$4)`, [sessionId, message, analysis.riskScore, analysis.explanation]); } catch {}
    return res.json({ blocked: true, sessionId, reply: null, analysis: analysisResult });
  }

  let reply: string;
  try { reply = await callLlm(settings, history, message); }
  catch (err) { return res.status(502).json({ error: `LLM call failed: ${err instanceof Error ? err.message : "Unknown error"}` }); }

  try { await pool.query(`INSERT INTO chat_messages (session_id,role,content,verdict,risk_score,is_blocked,blocked_reason) VALUES ($1,'user',$2,'ALLOW',$3,false,null),($1,'assistant',$4,null,null,false,null)`, [sessionId, message, analysis.riskScore, reply]); } catch {}

  return res.json({ blocked: false, sessionId, reply, analysis: analysisResult });
}
