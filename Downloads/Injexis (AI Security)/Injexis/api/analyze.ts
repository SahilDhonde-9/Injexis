import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getPool } from "./_db";
import { runAnalysis } from "./_analyze";
import { runSemanticCore } from "./_semantic";

const PRESERVATION_REVIEW_THRESHOLD = 40;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { prompt } = req.body ?? {};
  if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
    return res.status(400).json({ error: "Prompt is required" });
  }

  const pool = getPool();

  // ── Baseline: existing Hybrid + ML injection-pattern detectors ──────────
  let result;
  try {
    result = await runAnalysis(prompt);
  } catch {
    return res.status(502).json({ error: "Unable to reach detection models — please try again in a few seconds." });
  }

  // ── Semantic layer: segmentation, conflict analysis, selective deletion,
  //    meaning preservation — this is the project's core novelty ─────────
  let settings: { provider: string; api_key: string; model: string; base_url?: string | null } | null = null;
  try {
    const r = await pool.query("SELECT * FROM llm_settings LIMIT 1");
    settings = r.rows[0] ?? null;
  } catch {}

  let semanticExtras: {
    conflicts: unknown[];
    removedInstructions: string[];
    sanitizedPrompt: string | null;
    meaningPreservation: { score: number; preserved: boolean; explanation: string } | null;
    reviewRequired: boolean;
  } = { conflicts: [], removedInstructions: [], sanitizedPrompt: null, meaningPreservation: null, reviewRequired: false };

  try {
    const semantic = await runSemanticCore(prompt, settings?.api_key ? settings : null);
    const nothingLegitimateLeft = semantic.sanitizedPrompt.trim().length === 0;
    const isFullyMalicious = semantic.analysis.classification === "malicious" || nothingLegitimateLeft;
    const wasSanitized = semantic.removedInstructions.length > 0 && !isFullyMalicious;
    const lowPreservation = wasSanitized && semantic.meaningPreservation.score < PRESERVATION_REVIEW_THRESHOLD;

    semanticExtras = {
      conflicts: semantic.conflicts,
      removedInstructions: semantic.removedInstructions,
      sanitizedPrompt: wasSanitized ? semantic.sanitizedPrompt : null,
      meaningPreservation: wasSanitized
        ? { score: semantic.meaningPreservation.score, preserved: semantic.meaningPreservation.preserved, explanation: semantic.meaningPreservation.explanation }
        : null,
      reviewRequired: lowPreservation,
    };

    // Semantic layer catches harmful intent the injection-only detectors miss
    if (isFullyMalicious && result.verdict === "ALLOW") {
      result = {
        ...result,
        verdict: "BLOCK",
        isSafe: false,
        riskScore: Math.max(result.riskScore, semantic.analysis.riskScore),
        attackType: result.attackType ?? "harmful_intent",
        explanation: `This request was blocked. While the injection-pattern detectors saw it as low-risk (${result.riskScore.toFixed(1)}%), semantic intent analysis flagged it as harmful: "${semantic.analysis.intent}".`,
      };
        } else if (wasSanitized && lowPreservation) {
      // Adversarial part removed, but what's left is too thin/unclear to
      // auto-forward safely — flag for human review instead.
      result = {
        ...result,
        attackType: result.attackType ?? "partial_prompt_injection",
        explanation: `An adversarial instruction was removed, but the remaining content (meaning-preservation score: ${semantic.meaningPreservation.score}/100) is too unclear to safely auto-forward to the LLM. Flagged for manual review.`,
      };
    } else if (wasSanitized) {
      // A malicious instruction was embedded alongside a legitimate one —
      // report it, but don't hard-BLOCK since the legitimate part is safe.
      result = {
        ...result,
        attackType: result.attackType ?? "partial_prompt_injection",
        explanation: `${result.explanation} Semantic analysis additionally found ${semantic.removedInstructions.length} embedded adversarial instruction(s), shown below.`,
      };
    }
  } catch {
    // Semantic layer unavailable — fall back to baseline result only.
  }

  try {
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
      // ── New: semantic framework details for the UI ──
      conflicts: semanticExtras.conflicts,
      removedInstructions: semanticExtras.removedInstructions,
      sanitizedPrompt: semanticExtras.sanitizedPrompt,
      meaningPreservation: semanticExtras.meaningPreservation,
      reviewRequired: semanticExtras.reviewRequired,
    });
  } catch {
    return res.status(500).json({ error: "Failed to store result" });
  }
}