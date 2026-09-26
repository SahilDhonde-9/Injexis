import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getPool } from "./_db";
import { runAnalysis } from "./_analyze";
import { runSemanticCore } from "./_semantic";

function makeSessionId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function callLlm(
  settings: Record<string, string>,
  history: Array<{ role: string; content: string }>,
  userMessage: string
): Promise<string> {
  const provider = settings.provider;
  if (provider === "gemini") {
    const contents = [
      ...history.filter((m) => m.role !== "system").map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
      { role: "user", parts: [{ text: userMessage }] },
    ];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${settings.model}:generateContent?key=${settings.api_key}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents, generationConfig: { maxOutputTokens: 1500, temperature: 0.7 } }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`Gemini API error ${res.status}`);
    const data = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "(no response)";
  }
  const baseUrl =
    provider === "openai" ? "https://api.openai.com/v1"
    : provider === "groq" ? "https://api.groq.com/openai/v1"
    : settings.base_url ?? "https://api.openai.com/v1";
  const messages = [
    { role: "system", content: "You are a helpful AI assistant. This conversation is monitored by a prompt injection firewall." },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: userMessage },
  ];
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${settings.api_key}` },
    body: JSON.stringify({ model: settings.model, messages, max_tokens: 1500, temperature: 0.7 }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const body = await res.text();
    const providerName = provider === "groq" ? "Groq" : provider === "openai" ? "OpenAI" : "LLM provider";
    if (res.status === 429) {
      throw new Error(
        `${providerName} rate limit or quota exceeded. Check your billing/quota, API key, or switch provider in Settings.`
      );
    }
    throw new Error(`LLM API error ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content ?? "(no response)";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const pool = getPool();

   // ── Load chat history for a session, OR list all recent sessions ────────
  if (req.method === "GET") {
    // ?list=true → return every past session (for the "Recent Chats" sidebar)
    if (req.query.list === "true") {
      try {
        const { rows } = await pool.query(
          `SELECT m.session_id,
                  (SELECT content FROM chat_messages m2
                   WHERE m2.session_id = m.session_id AND m2.role = 'user'
                   ORDER BY m2.id ASC LIMIT 1) AS title,
                  MAX(m.created_at) AS last_activity,
                  COUNT(*)::int AS message_count
           FROM chat_messages m
           GROUP BY m.session_id
           ORDER BY last_activity DESC
           LIMIT 30`
        );
        return res.json({ sessions: rows });
      } catch {
        return res.json({ sessions: [] });
      }
    }

    // ?sessionId=xxx → return the messages for one session
    const sessionId = req.query.sessionId as string | undefined;
    if (!sessionId) return res.status(400).json({ error: "sessionId is required" });
    try {
      const { rows } = await pool.query(
        `SELECT id, role, content, verdict, risk_score, is_blocked, blocked_reason, created_at
         FROM chat_messages WHERE session_id = $1 ORDER BY id ASC`,
        [sessionId]
      );
      return res.json({ messages: rows });
    } catch {
      return res.json({ messages: [] });
    }
  }

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { message, history = [], sessionId: incomingSession } = req.body ?? {};
  if (!message || typeof message !== "string") return res.status(400).json({ error: "message is required" });
  const sessionId = incomingSession ?? makeSessionId();

  const settingsRows = await pool.query("SELECT * FROM llm_settings LIMIT 1");
  if (settingsRows.rows.length === 0) return res.status(503).json({ error: "No LLM configured. Add your API key in Settings first." });
  const settings = settingsRows.rows[0];

  // ── 1. Semantic pipeline: segment the prompt, classify each part,
  //       selectively remove only adversarial instructions ───────────────
  let semantic;
  try {
    semantic = await runSemanticCore(message, settings.api_key ? settings : null);
  } catch {
    return res.status(502).json({ error: "Detection models unavailable — please try again shortly." });
  }

  const nothingLegitimateLeft = semantic.sanitizedPrompt.trim().length === 0;
  const isFullyMalicious = semantic.analysis.classification === "malicious" || nothingLegitimateLeft;

  // Entire prompt is adversarial → hard block (nothing legitimate to preserve)
  if (isFullyMalicious) {
    try {
      await pool.query(
        `INSERT INTO chat_messages (session_id, role, content, verdict, risk_score, is_blocked, blocked_reason)
         VALUES ($1,'user',$2,'BLOCK',$3,true,$4)`,
        [sessionId, message, semantic.analysis.riskScore, semantic.meaningPreservation.explanation || "No legitimate content found"]
      );
    } catch {}
    return res.json({
      blocked: true,
      sessionId,
      reply: null,
      analysis: {
        verdict: "BLOCK",
        riskScore: semantic.analysis.riskScore,
        attackType: "prompt_injection",
        hybridProbability: semantic.analysis.riskScore / 100,
        mlStatus: "DANGEROUS",
        mlConfidence: semantic.analysis.confidence,
        explanation: `Blocked — the entire message was classified as adversarial. ${semantic.meaningPreservation.explanation}`,
      },
      sanitized: null,
    });
  }

  // ── 2. Post-deletion validation: re-check the CLEANED prompt with the
  //       existing Hybrid+ML detector, as an independent second opinion ───
  let postValidation: Awaited<ReturnType<typeof runAnalysis>> | null = null;
  try {
    postValidation = await runAnalysis(semantic.sanitizedPrompt);
  } catch {
    postValidation = null; // degrade gracefully, proceed on semantic result alone
  }

  if (postValidation?.verdict === "BLOCK") {
    try {
      await pool.query(
        `INSERT INTO chat_messages (session_id, role, content, verdict, risk_score, is_blocked, blocked_reason)
         VALUES ($1,'user',$2,'BLOCK',$3,true,$4)`,
        [sessionId, message, postValidation.riskScore, "Sanitized prompt still failed post-deletion validation"]
      );
    } catch {}
    return res.json({
      blocked: true,
      sessionId,
      reply: null,
      analysis: {
        verdict: "BLOCK",
        riskScore: postValidation.riskScore,
        attackType: postValidation.attackType,
        hybridProbability: postValidation.hybridProbability,
        mlStatus: postValidation.mlStatus,
        mlConfidence: postValidation.mlConfidence,
        explanation: "Even after removing suspicious instructions, the remaining content still failed a second security check.",
      },
      sanitized: null,
    });
  }

  const wasSanitized = semantic.removedInstructions.length > 0;
  const finalRisk = postValidation?.riskScore ?? semantic.analysis.riskScore;

  try {
    await pool.query(
      `INSERT INTO chat_messages (session_id, role, content, verdict, risk_score, is_blocked, blocked_reason)
       VALUES ($1,'user',$2,$3,$4,false,$5)`,
      [sessionId, message, wasSanitized ? "SANITIZED" : "ALLOW", finalRisk, wasSanitized ? `Removed: ${semantic.removedInstructions.join("; ")}` : null]
    );
  } catch {}

  // ── 3. Only the SANITIZED prompt is ever sent to the LLM ─────────────────
  let reply: string;
  try {
    reply = await callLlm(settings, history, semantic.sanitizedPrompt);
  } catch (err) {
    return res.status(502).json({ error: `LLM call failed: ${err instanceof Error ? err.message : "Unknown error"}` });
  }

  try {
    await pool.query(`INSERT INTO chat_messages (session_id, role, content, is_blocked) VALUES ($1,'assistant',$2,false)`, [sessionId, reply]);
  } catch {}

  return res.json({
    blocked: false,
    sessionId,
    reply,
    analysis: {
      verdict: wasSanitized ? "SANITIZED" : "ALLOW",
      riskScore: finalRisk,
      attackType: wasSanitized ? "partial_prompt_injection" : null,
      hybridProbability: postValidation?.hybridProbability ?? finalRisk / 100,
      mlStatus: postValidation?.mlStatus ?? (wasSanitized ? "SANITIZED" : "SAFE"),
      mlConfidence: postValidation?.mlConfidence ?? semantic.analysis.confidence,
      explanation: wasSanitized
        ? `Removed ${semantic.removedInstructions.length} suspicious instruction(s) before sending to the LLM. Your legitimate request was answered normally.`
        : "No adversarial content detected — full message sent to the LLM.",
    },
    sanitized: wasSanitized
      ? { sanitizedPrompt: semantic.sanitizedPrompt, removedInstructions: semantic.removedInstructions }
      : null,
  });
}