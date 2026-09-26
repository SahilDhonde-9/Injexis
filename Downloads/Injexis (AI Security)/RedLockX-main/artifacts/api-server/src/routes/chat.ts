import { Router } from "express";
import { saveAnalysisLog, saveChatMessages, getLlmSettings } from "../lib/local-store";
import { runAnalysis } from "../lib/analyze-engine";
import { z } from "zod";
import type { LlmSettingsEntry } from "../lib/local-store";

const router = Router();

const ChatHistoryMessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
});

const ChatRequestSchema = z.object({
  message: z.string().min(1).max(10000),
  sessionId: z.string().nullable().optional(),
  history: z.array(ChatHistoryMessageSchema).default([]),
});

type ChatHistoryMessage = z.infer<typeof ChatHistoryMessageSchema>;

function makeSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function callLlm(
  settings: LlmSettingsEntry,
  history: ChatHistoryMessage[],
  userMessage: string
): Promise<string> {
  const provider = settings.provider;

  if (provider === "gemini") {
    const contents = [
      ...history
        .filter((m) => m.role !== "system")
        .map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        })),
      { role: "user", parts: [{ text: userMessage }] },
    ];

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${settings.model}:generateContent?key=${settings.apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        generationConfig: { maxOutputTokens: 1500, temperature: 0.7 },
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Gemini API error ${res.status}: ${body.slice(0, 200)}`);
    }

    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "(no response)";
  }

  const baseUrl =
    provider === "openai"
      ? "https://api.openai.com/v1"
      : provider === "groq"
      ? "https://api.groq.com/openai/v1"
      : settings.baseUrl ?? "https://api.openai.com/v1";

  const messages = [
    {
      role: "system",
      content:
        "You are a helpful AI assistant. Answer clearly and concisely. This conversation is monitored by a prompt injection firewall — only safe, benign requests reach you.",
    },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: userMessage },
  ];

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey}`,
    },
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

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content ?? "(no response)";
}

router.post("/chat", async (req, res) => {
  const parsed = ChatRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid request" });
    return;
  }

  const { message, history } = parsed.data;
  const sessionId = parsed.data.sessionId ?? makeSessionId();

    const settings = getLlmSettings();
  if (!settings) {
    res.status(503).json({ error: "No LLM configured. Add your API key in Settings first." });
    return;
  }

  let analysis;
  try {
    analysis = await runAnalysis(message);
  } catch (err) {
    req.log.error({ err }, "Firewall analysis failed in chat");
    res.status(502).json({
      error:
        "Detection models are unavailable. The HuggingFace spaces may be sleeping — try again shortly.",
    });
    return;
  }

  let logId = 0;
  try {
    const logged = saveAnalysisLog({
      prompt: message,
      verdict: analysis.verdict,
      riskScore: analysis.riskScore,
      isSafe: analysis.isSafe,
      attackType: analysis.attackType,
      hybridProbability: analysis.hybridProbability,
      mlStatus: analysis.mlStatus,
      mlConfidence: analysis.mlConfidence,
      explanation: analysis.explanation,
    });
    logId = logged.id;
  } catch (err) {
    req.log.error({ err }, "Failed to persist chat analysis log");
  }

  const analysisResult = {
    id: logId,
    verdict: analysis.verdict,
    riskScore: analysis.riskScore,
    isSafe: analysis.isSafe,
    attackType: analysis.attackType,
    hybridProbability: analysis.hybridProbability,
    mlStatus: analysis.mlStatus,
    mlConfidence: analysis.mlConfidence,
    explanation: analysis.explanation,
    createdAt: new Date().toISOString(),
  };

  if (analysis.verdict === "BLOCK") {
    try {
      saveChatMessages([
        {
          sessionId,
          role: "user",
          content: message,
          verdict: "BLOCK",
          riskScore: analysis.riskScore,
          isBlocked: true,
          blockedReason: analysis.explanation,
        },
      ]);
    } catch (err) {
      req.log.error({ err }, "Failed to save blocked chat message");
    }

    res.json({ blocked: true, sessionId, reply: null, analysis: analysisResult });
    return;
  }

  let reply: string;
  try {
    reply = await callLlm(settings, history, message);
  } catch (err) {
    req.log.error({ err }, "LLM call failed");
    res.status(502).json({
      error: `LLM call failed: ${err instanceof Error ? err.message : "Unknown error"}`,
    });
    return;
  }

  try {
    saveChatMessages([
      {
        sessionId,
        role: "user",
        content: message,
        verdict: "ALLOW",
        riskScore: analysis.riskScore,
        isBlocked: false,
        blockedReason: null,
      },
      {
        sessionId,
        role: "assistant",
        content: reply,
        verdict: null,
        riskScore: null,
        isBlocked: false,
        blockedReason: null,
      },
    ]);
  } catch (err) {
    req.log.error({ err }, "Failed to save chat messages");
  }

  res.json({ blocked: false, sessionId, reply, analysis: analysisResult });
});

export default router;
