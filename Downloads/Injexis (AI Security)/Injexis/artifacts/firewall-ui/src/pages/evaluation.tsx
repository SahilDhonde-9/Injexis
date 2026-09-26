import React, { useState } from "react";
import { FlaskConical, Play, CheckCircle2, XCircle, Clock, Scale, Target, Percent } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface Metrics {
  tp: number; tn: number; fp: number; fn: number;
  precision: number; recall: number; f1: number; accuracy: number;
  falsePositiveRate: number; falseNegativeRate: number;
}

interface EvalItem {
  id: number; prompt: string; category: string; expected: string;
  baselinePredicted: string; proposedPredicted: string; elapsedMs: number;
}

interface EvalResult {
  total: number;
  avgProcessingTimeMs: number;
  baseline: Metrics;
  proposed: Metrics;
  items: EvalItem[];
}

function pct(n: number) { return `${(n * 100).toFixed(1)}%`; }

export default function EvaluationPage() {
  const [result, setResult] = useState<EvalResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "correct" | "wrong">("all");

  async function runEvaluation() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/evaluate");
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error ?? "Evaluation failed");
      }
      setResult(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Evaluation failed");
    } finally {
      setLoading(false);
    }
  }

  const filteredItems = result?.items.filter((it) => {
    const correct = it.proposedPredicted === it.expected;
    if (filter === "correct") return correct;
    if (filter === "wrong") return !correct;
    return true;
  }) ?? [];

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="relative rounded-xl border border-slate-700/60 bg-gradient-to-r from-slate-900 via-slate-800/80 to-slate-900 overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-purple-500/80 via-blue-500/60 to-transparent rounded-l-xl" />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-purple-500/40 bg-purple-500/10">
              <FlaskConical className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white leading-none">Evaluation</h2>
              <p className="text-[11px] text-slate-500 font-mono mt-1">
                Baseline (pattern-only) vs Proposed (semantic pipeline) — curated test set
              </p>
            </div>
          </div>
          <button
            onClick={runEvaluation}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-sm transition-all shadow-[0_0_20px_rgba(147,51,234,0.3)]"
          >
            {loading ? <Clock className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {loading ? "Running… (~1-2 min)" : "Run Evaluation"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {!result && !loading && (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-center rounded-xl border border-slate-700/40 bg-[hsl(222,47%,4%)]">
          <FlaskConical className="h-10 w-10 text-slate-700" />
          <p className="text-slate-500 text-sm font-mono">
            Click "Run Evaluation" to test the live pipeline against 24 labeled prompts
          </p>
        </div>
      )}

      {loading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl bg-slate-800/50" />)}
        </div>
      )}

      {result && !loading && (
        <>
          {/* ── Baseline vs Proposed comparison ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <MetricsCard title="Baseline — Injection-Pattern Only" subtitle="Hybrid + ML, no semantic layer" metrics={result.baseline} accent="slate" />
            <MetricsCard title="Proposed — Full Semantic Pipeline" subtitle="Hybrid + ML + Semantic + Guard Model" metrics={result.proposed} accent="purple" />
          </div>

          {/* ── Improvement summary ── */}
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-5 py-4 flex flex-wrap items-center gap-x-8 gap-y-2">
            <div>
              <p className="text-[10px] font-mono uppercase text-slate-500">Accuracy Improvement</p>
              <p className="text-xl font-black font-mono text-emerald-400">
                {result.baseline.accuracy > 0
                  ? `+${((result.proposed.accuracy - result.baseline.accuracy) * 100).toFixed(1)} pts`
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-mono uppercase text-slate-500">Recall Improvement</p>
              <p className="text-xl font-black font-mono text-emerald-400">
                +{((result.proposed.recall - result.baseline.recall) * 100).toFixed(1)} pts
              </p>
            </div>
            <div>
              <p className="text-[10px] font-mono uppercase text-slate-500">Avg Processing Time</p>
              <p className="text-xl font-black font-mono text-white">{result.avgProcessingTimeMs} ms</p>
            </div>
            <div>
              <p className="text-[10px] font-mono uppercase text-slate-500">Test Set Size</p>
              <p className="text-xl font-black font-mono text-white">{result.total} prompts</p>
            </div>
          </div>

          {/* ── Confusion matrices ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ConfusionMatrix title="Baseline Confusion Matrix" m={result.baseline} />
            <ConfusionMatrix title="Proposed Confusion Matrix" m={result.proposed} />
          </div>

          {/* ── Per-item results ── */}
          <div className="rounded-xl border border-slate-700/60 bg-[hsl(222,47%,4%)] overflow-hidden">
            <div className="px-5 pt-4 pb-3 border-b border-slate-700/40 flex items-center justify-between flex-wrap gap-2">
              <p className="text-sm font-bold text-white">Per-Prompt Results (Proposed Pipeline)</p>
              <div className="flex gap-1.5">
                {(["all", "correct", "wrong"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold uppercase transition-colors ${
                      filter === f ? "bg-purple-500/20 text-purple-300 border border-purple-500/40" : "text-slate-500 border border-transparent hover:text-slate-300"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
            <div className="divide-y divide-slate-800/60 max-h-[500px] overflow-y-auto">
              {filteredItems.map((it) => {
                const correct = it.proposedPredicted === it.expected;
                return (
                  <div key={it.id} className="px-5 py-3 flex items-start gap-3">
                    {correct
                      ? <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                      : <XCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono text-slate-300 truncate">{it.prompt}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap text-[10px] font-mono">
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">{it.category}</span>
                        <span className="text-slate-600">expected: <span className="text-slate-300">{it.expected}</span></span>
                        <span className="text-slate-600">got: <span className={correct ? "text-emerald-400" : "text-red-400"}>{it.proposedPredicted}</span></span>
                        <span className="text-slate-700">{it.elapsedMs}ms</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function MetricsCard({ title, subtitle, metrics, accent }: { title: string; subtitle: string; metrics: Metrics; accent: "slate" | "purple" }) {
  const border = accent === "purple" ? "border-purple-500/30" : "border-slate-700/60";
  const bg = accent === "purple" ? "from-purple-500/6" : "from-slate-500/3";
  return (
    <div className={`rounded-xl border ${border} bg-gradient-to-br ${bg} to-transparent bg-[hsl(222,47%,4%)] p-5`}>
      <p className="text-sm font-bold text-white">{title}</p>
      <p className="text-[10px] text-slate-500 font-mono mb-4">{subtitle}</p>
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Accuracy" value={pct(metrics.accuracy)} icon={<Target className="h-3.5 w-3.5" />} />
        <Stat label="Precision" value={pct(metrics.precision)} icon={<Scale className="h-3.5 w-3.5" />} />
        <Stat label="Recall" value={pct(metrics.recall)} icon={<Percent className="h-3.5 w-3.5" />} />
        <Stat label="F1-Score" value={pct(metrics.f1)} icon={<FlaskConical className="h-3.5 w-3.5" />} />
      </div>
      <div className="mt-3 pt-3 border-t border-slate-800/60 flex justify-between text-[10px] font-mono text-slate-500">
        <span>FP rate: <span className="text-red-400">{pct(metrics.falsePositiveRate)}</span></span>
        <span>FN rate: <span className="text-red-400">{pct(metrics.falseNegativeRate)}</span></span>
      </div>
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-slate-800/40 border border-slate-700/40 p-2.5">
      <div className="flex items-center gap-1.5 text-slate-500 mb-1">{icon}<span className="text-[9px] font-mono uppercase">{label}</span></div>
      <p className="text-lg font-black font-mono text-white">{value}</p>
    </div>
  );
}

function ConfusionMatrix({ title, m }: { title: string; m: Metrics }) {
  return (
    <div className="rounded-xl border border-slate-700/60 bg-[hsl(222,47%,4%)] p-5">
      <p className="text-sm font-bold text-white mb-3">{title}</p>
      <div className="grid grid-cols-3 gap-1 text-center text-[10px] font-mono">
        <div />
        <div className="text-slate-500 pb-1">Predicted ALLOW</div>
        <div className="text-slate-500 pb-1">Predicted BLOCK</div>

        <div className="text-slate-500 flex items-center justify-end pr-2">Actual ALLOW</div>
        <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 py-3 text-emerald-400 font-black text-base">{m.tn}</div>
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 py-3 text-red-400 font-black text-base">{m.fp}</div>

        <div className="text-slate-500 flex items-center justify-end pr-2">Actual BLOCK</div>
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 py-3 text-red-400 font-black text-base">{m.fn}</div>
        <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 py-3 text-emerald-400 font-black text-base">{m.tp}</div>
      </div>
    </div>
  );
}