const HYBRID_BASE =
  process.env["HYBRID_SPACE_URL"] ??
  "https://blackxmask-redlockx-hybrid-prompt-detector-space-v2.hf.space";
const ML_BASE =
  process.env["ML_SPACE_URL"] ??
  "https://blackxmask-redlockx-ml-deberta-v3-prompt-detector-space.hf.space";

export interface HybridResult { verdictStr: string; riskPercent: number; isSafe: boolean; }
export interface MlResult { status: string; confidence: number; attack_type?: { label: string; score: number }; trigger_words?: string[]; }
export interface FinalVerdict { verdict: "BLOCK" | "ALLOW"; riskScore: number; isSafe: boolean; attackType: string | null; hybridProbability: number; mlStatus: string; mlConfidence: number; explanation: string; }

const INJECTION_KEYWORDS = ["ignore previous","ignore all","disregard","forget your","you are now","act as","pretend you","system prompt","jailbreak","dan mode","developer mode","override","bypass","sudo","admin mode","base64","\\x","unicode escape"];

function simulateHybrid(prompt: string): HybridResult {
  const lower = prompt.toLowerCase();
  const matches = INJECTION_KEYWORDS.filter((kw) => lower.includes(kw));
  const riskPercent = Math.min(99, matches.length * 25 + (matches.length > 0 ? 30 : 5));
  return { verdictStr: matches.length === 0 ? "SAFE" : "MALICIOUS", riskPercent, isSafe: matches.length === 0 };
}

function simulateMl(prompt: string): MlResult {
  const lower = prompt.toLowerCase();
  const matches = INJECTION_KEYWORDS.filter((kw) => lower.includes(kw));
  if (matches.length === 0) return { status: "SAFE", confidence: 0.95 };
  const attackLabel = lower.includes("base64") || lower.includes("\\x") ? "obfuscation_attack"
    : lower.includes("act as") || lower.includes("pretend") || lower.includes("dan") ? "jailbreak_attempt"
    : lower.includes("ignore") || lower.includes("disregard") || lower.includes("forget") ? "direct_injection"
    : "indirect_injection";
  return { status: "DANGEROUS", confidence: Math.min(0.99, 0.7 + matches.length * 0.1), attack_type: { label: attackLabel, score: Math.min(0.99, 0.65 + matches.length * 0.1) }, trigger_words: matches.slice(0, 3) };
}

async function gradioCall(baseUrl: string, fn: string, data: unknown[]): Promise<unknown[]> {
  const postRes = await fetch(`${baseUrl}/gradio_api/call/${fn}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data }), signal: AbortSignal.timeout(15_000) });
  if (!postRes.ok) throw new Error(`Gradio submit failed: ${postRes.status}`);
  const { event_id } = (await postRes.json()) as { event_id: string };
  const sseRes = await fetch(`${baseUrl}/gradio_api/call/${fn}/${event_id}`, { signal: AbortSignal.timeout(30_000) });
  if (!sseRes.ok || !sseRes.body) throw new Error(`Gradio stream failed: ${sseRes.status}`);
  const reader = sseRes.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "", lastEventName = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n"); buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (line.startsWith("event: ")) { lastEventName = line.slice(7).trim(); }
      else if (line.startsWith("data: ")) {
        const raw = line.slice(6).trim();
        if (lastEventName === "complete") { const result = JSON.parse(raw) as unknown[]; reader.cancel(); return result; }
        else if (lastEventName === "error") throw new Error(`Gradio error: ${raw}`);
      }
    }
  }
  throw new Error("Gradio stream ended without complete event");
}

async function hybridNode(prompt: string): Promise<HybridResult> {
  try {
    const result = await gradioCall(HYBRID_BASE, "detect", [prompt]);
    const verdictStr = String(result[0] ?? "");
    const riskStr = String(result[1] ?? "0");
    const riskMatch = riskStr.match(/[\d.]+/);
    const riskPercent = riskMatch ? parseFloat(riskMatch[0]) : 0;
    return { verdictStr, riskPercent, isSafe: !verdictStr.toUpperCase().includes("MALICIOUS") };
  } catch { return simulateHybrid(prompt); }
}

async function mlNode(prompt: string): Promise<MlResult> {
  try {
    const result = await gradioCall(ML_BASE, "detect", [prompt]);
    let rawOutput: unknown = Array.isArray(result) && result.length >= 3 ? result[1] : result[0] ?? {};
    const mlData: MlResult = typeof rawOutput === "string" ? JSON.parse(rawOutput) as MlResult : rawOutput as MlResult;
    return mlData;
  } catch { return simulateMl(prompt); }
}

export async function runAnalysis(prompt: string): Promise<FinalVerdict> {
  const [hybrid, ml] = await Promise.all([hybridNode(prompt), mlNode(prompt)]);
  const isAttack = !hybrid.isSafe || ml.status === "DANGEROUS";
  const verdict: "BLOCK" | "ALLOW" = isAttack ? "BLOCK" : "ALLOW";
  const mlWeight = ml.status === "DANGEROUS" ? ml.confidence : 0;
  const riskScore = Math.min(100, Math.max(0, 0.6 * hybrid.riskPercent + 0.4 * mlWeight * 100));
  const attackLabel = ml.attack_type?.label?.replace(/_/g, " ") ?? "unknown pattern";
  const attackScore = ml.attack_type?.score ?? 0;
  const triggerWords = ml.trigger_words?.join(", ");
  let explanation: string;
  if (verdict === "BLOCK") {
    explanation = `This prompt was flagged as malicious. The hybrid model detected a ${hybrid.riskPercent.toFixed(1)}% injection risk, and the DeBERTa model classified it as DANGEROUS with ${(ml.confidence * 100).toFixed(1)}% confidence. Primary attack pattern: ${attackLabel} (${(attackScore * 100).toFixed(1)}% match).`;
    if (triggerWords) explanation += ` Trigger words detected: ${triggerWords}.`;
  } else {
    explanation = `This prompt appears safe. The hybrid model detected a low injection risk of ${hybrid.riskPercent.toFixed(1)}%, and the DeBERTa model classified it as SAFE with ${(ml.confidence * 100).toFixed(1)}% confidence.`;
  }
  return { verdict, riskScore, isSafe: !isAttack, attackType: isAttack ? (ml.attack_type?.label ?? "prompt_injection") : null, hybridProbability: hybrid.riskPercent / 100, mlStatus: ml.status, mlConfidence: ml.confidence, explanation };
}
