import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ShieldAlert,
  Shield,
  ArrowRight,
  Network,
  BrainCircuit,
  GitMerge,
  Zap,
  CircleCheck,
  CircleX,
  ScanLine,
  Lock,
  Unlock,
  AlertTriangle,
} from "lucide-react";
import { useAnalyzePrompt } from "@workspace/api-client-react";
import type { AnalysisResult } from "@workspace/api-client-react/src/generated/api.schemas";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  prompt: z.string().min(1, "Prompt is required").max(10000, "Prompt is too long"),
});

export default function Analyzer() {
  const [results, setResults] = useState<AnalysisResult[]>([]);
  const [isPulsing, setIsPulsing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { prompt: "" },
  });

  const analyzePrompt = useAnalyzePrompt();

  function onSubmit(values: z.infer<typeof formSchema>) {
    setIsPulsing(true);
    setLastError(null);
    analyzePrompt.mutate(
      { data: values },
      {
        onSuccess: (data) => {
          setResults((prev) => [data, ...prev]);
          setLastError(null);
          form.reset();
          setIsPulsing(false);
        },
        onError: (err) => {
          setIsPulsing(false);
          const msg =
            (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
            (err as Error)?.message ??
            "Analysis failed. The detection models may be sleeping — please try again.";
          setLastError(msg);
          toast({
            variant: "destructive",
            title: "Analysis Error",
            description: msg,
          });
        },
      }
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Page Header ──────────────────────────────────── */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <h2 className="text-3xl font-black tracking-tight text-white">
            Prompt Analyzer
          </h2>
          <p className="text-base text-slate-400 mt-0.5">
            Real-time injection detection via parallel AI pipeline
          </p>
        </div>
        <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-sm font-mono font-bold text-emerald-400 tracking-widest uppercase">
            Systems Online
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ── Left: Input ──────────────────────────────── */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* Input card */}
          <div className="rounded-xl border-2 border-blue-500/40 bg-[hsl(222,47%,6%)] shadow-[0_0_30px_rgba(59,130,246,0.1)] overflow-hidden">
            <div className="px-5 py-4 border-b border-blue-500/20 flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-500/20 border border-blue-500/30">
                <Zap className="h-4 w-4 text-blue-400" />
              </div>
              <div>
                <p className="text-base font-bold text-white">Real-time Analysis</p>
                <p className="text-xs text-slate-500 font-mono">Parallel · Hybrid + DeBERTa-v3</p>
              </div>
            </div>

            <div className="p-5">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="prompt"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Textarea
                            placeholder="Paste or type any prompt to analyze..."
                            className="min-h-[180px] font-mono text-sm resize-none bg-[hsl(222,47%,4%)] border-2 border-slate-700 focus-visible:border-blue-500 focus-visible:ring-0 text-slate-100 placeholder:text-slate-600"
                            {...field}
                            data-testid="input-prompt"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    className="w-full h-12 font-black text-base tracking-[0.15em] uppercase bg-blue-600 hover:bg-blue-500 text-white border-0 shadow-[0_0_20px_rgba(59,130,246,0.35)] hover:shadow-[0_0_30px_rgba(59,130,246,0.55)] transition-all"
                    disabled={analyzePrompt.isPending}
                    data-testid="button-analyze"
                  >
                    {analyzePrompt.isPending ? (
                      <span className="flex items-center gap-3">
                        <ScanLine className="h-5 w-5 animate-pulse" />
                        Running Models...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        Analyze Prompt
                        <ArrowRight className="h-5 w-5" />
                      </span>
                    )}
                  </Button>
                </form>
              </Form>
            </div>
          </div>

          {/* Pipeline diagram */}
          <div className="rounded-xl border border-slate-700/60 bg-[hsl(222,47%,5%)] p-5">
            <p className="text-xs font-mono uppercase tracking-widest text-slate-500 mb-4">
              Detection Pipeline
            </p>
            <div className="flex flex-col items-center gap-0">
              {/* Input node */}
              <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-blue-500/40 bg-blue-500/10 w-full justify-center">
                <ArrowRight className="h-3.5 w-3.5 text-blue-400" />
                <span className="text-sm font-bold text-blue-300 font-mono tracking-wide">INPUT</span>
              </div>

              {/* Fan-out */}
              <div className="flex gap-6 relative w-full justify-center my-1">
                <div className="absolute top-1/2 left-1/4 w-1/2 border-t border-dashed border-slate-600/60 -translate-y-1/2" />
                <div className="w-px h-4 bg-slate-600/60 mx-auto" />
              </div>

              {/* Parallel nodes */}
              <div className="grid grid-cols-2 gap-3 w-full">
                <div className={`flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-lg border transition-all duration-500 ${
                  analyzePrompt.isPending
                    ? "border-yellow-500/60 bg-yellow-500/10 shadow-[0_0_12px_rgba(234,179,8,0.2)]"
                    : "border-slate-700/60 bg-slate-800/30"
                }`}>
                  <Network className={`h-4 w-4 ${analyzePrompt.isPending ? "text-yellow-400 animate-pulse" : "text-slate-500"}`} />
                  <span className={`text-xs font-bold font-mono tracking-wider ${analyzePrompt.isPending ? "text-yellow-300" : "text-slate-500"}`}>
                    HYBRID
                  </span>
                  <span className={`text-[9px] font-mono ${analyzePrompt.isPending ? "text-yellow-500/70" : "text-slate-600"}`}>
                    XGBoost + MiniLM
                  </span>
                </div>

                <div className={`flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-lg border transition-all duration-500 ${
                  analyzePrompt.isPending
                    ? "border-purple-500/60 bg-purple-500/10 shadow-[0_0_12px_rgba(168,85,247,0.2)]"
                    : "border-slate-700/60 bg-slate-800/30"
                }`}>
                  <BrainCircuit className={`h-4 w-4 ${analyzePrompt.isPending ? "text-purple-400 animate-pulse" : "text-slate-500"}`} />
                  <span className={`text-xs font-bold font-mono tracking-wider ${analyzePrompt.isPending ? "text-purple-300" : "text-slate-500"}`}>
                    ML LAYER
                  </span>
                  <span className={`text-[9px] font-mono ${analyzePrompt.isPending ? "text-purple-500/70" : "text-slate-600"}`}>
                    DeBERTa-v3
                  </span>
                </div>
              </div>

              {/* Fan-in */}
              <div className="flex gap-6 relative w-full justify-center my-1">
                <div className="absolute top-1/2 left-1/4 w-1/2 border-t border-dashed border-slate-600/60 -translate-y-1/2" />
                <div className="w-px h-4 bg-slate-600/60 mx-auto" />
              </div>

              {/* Decision node */}
              <div className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border w-full justify-center transition-all duration-500 ${
                analyzePrompt.isPending
                  ? "border-blue-400/70 bg-blue-500/15 shadow-[0_0_16px_rgba(59,130,246,0.25)]"
                  : "border-slate-700/50 bg-slate-800/20"
              }`}>
                <GitMerge className={`h-3.5 w-3.5 ${analyzePrompt.isPending ? "text-blue-400 animate-pulse" : "text-slate-600"}`} />
                <span className={`text-sm font-bold font-mono tracking-wide ${analyzePrompt.isPending ? "text-blue-300" : "text-slate-500"}`}>
                  DECISION
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right: Results ────────────────────────────── */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-black uppercase tracking-[0.15em] text-slate-400">
              Analysis Results
            </h3>
            {results.length > 0 && (
              <span className="px-2 py-0.5 rounded-md bg-blue-500/15 border border-blue-500/30 text-xs font-mono font-bold text-blue-400">
                {results.length}
              </span>
            )}
          </div>

          {lastError && (
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-red-500/40 bg-red-950/30 text-sm text-red-300 font-mono">
              <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-red-400 mb-0.5">Analysis Failed</p>
                <p className="text-red-300/80">{lastError}</p>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-4 overflow-y-auto pb-10">
            {results.length === 0 && !lastError && (
              <div className={`flex flex-col items-center justify-center text-center p-16 rounded-xl border-2 border-dashed transition-all duration-500 ${
                isPulsing
                  ? "border-blue-500/50 bg-blue-500/5 shadow-[0_0_40px_rgba(59,130,246,0.1)]"
                  : "border-slate-700/50 bg-[hsl(222,47%,5%)]"
              }`}>
                {isPulsing ? (
                  <>
                    <div className="relative mb-6">
                      <ScanLine className="h-14 w-14 text-blue-400 animate-pulse" />
                      <span className="absolute inset-0 rounded-full bg-blue-500/10 animate-ping" />
                    </div>
                    <p className="text-lg font-bold text-blue-300 font-mono">
                      Running pipeline...
                    </p>
                    <p className="text-sm text-slate-500 mt-1 font-mono">
                      hybridNode ⟶ mlNode ⟶ decisionNode
                    </p>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-center h-16 w-16 rounded-xl border-2 border-slate-700/60 bg-slate-800/30 mb-5">
                      <Shield className="h-8 w-8 text-slate-600" />
                    </div>
                    <p className="text-base font-bold text-slate-500 font-mono">
                      Awaiting input
                    </p>
                    <p className="text-sm text-slate-600 mt-1">
                      Submit a prompt to run the detection pipeline
                    </p>
                  </>
                )}
              </div>
            )}

            {results.map((result, i) => (
              <ResultCard key={result.id ?? i} result={result} isLatest={i === 0} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ResultCard({ result, isLatest }: { result: AnalysisResult; isLatest: boolean }) {
  const isBlock = result.verdict === "BLOCK";
  const hybridRisk = result.hybridProbability * 100;
  const mlConfidencePct = result.mlConfidence * 100;
  const hybridMalicious = hybridRisk > 50;
  const mlDangerous = result.mlStatus === "DANGEROUS";

  return (
    <div
      className={`rounded-xl border-2 overflow-hidden transition-all duration-300 animate-in fade-in slide-in-from-right-4 ${
        isBlock
          ? "border-red-500/60 shadow-[0_0_30px_rgba(239,68,68,0.18)]"
          : "border-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.12)]"
      } ${isLatest ? "ring-1 " + (isBlock ? "ring-red-500/20" : "ring-emerald-500/20") : "opacity-80 hover:opacity-100"}`}
    >
      {/* ── Verdict Banner ─────────────────────────────── */}
      <div
        className={`px-5 py-4 flex items-center justify-between ${
          isBlock
            ? "bg-gradient-to-r from-red-950/80 via-red-900/40 to-transparent border-b border-red-500/30"
            : "bg-gradient-to-r from-emerald-950/80 via-emerald-900/30 to-transparent border-b border-emerald-500/25"
        }`}
      >
        <div className="flex items-center gap-4">
          {/* Big verdict icon */}
          <div className={`flex h-14 w-14 items-center justify-center rounded-xl border-2 shrink-0 ${
            isBlock
              ? "bg-red-500/20 border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.3)]"
              : "bg-emerald-500/20 border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.2)]"
          }`}>
            {isBlock
              ? <Lock className="h-7 w-7 text-red-400" />
              : <Unlock className="h-7 w-7 text-emerald-400" />
            }
          </div>

          <div>
            <div className={`text-3xl font-black tracking-[0.2em] ${
              isBlock ? "text-red-400" : "text-emerald-400"
            }`}>
              {result.verdict}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              {result.attackType ? (
                <span className="px-2 py-0.5 rounded text-xs font-mono font-bold uppercase tracking-wider bg-red-500/20 text-red-300 border border-red-500/30">
                  {result.attackType.replace(/_/g, " ")}
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-xs font-mono font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                  no threat detected
                </span>
              )}
              <span className="text-xs text-slate-500 font-mono">
                #{result.id} · {new Date(result.createdAt).toLocaleTimeString()}
              </span>
            </div>
          </div>
        </div>

        {/* Risk score */}
        <div className="text-right shrink-0">
          <div className={`text-4xl font-black font-mono tabular-nums leading-none ${
            result.riskScore > 70
              ? "text-red-400 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]"
              : result.riskScore > 30
              ? "text-yellow-300"
              : "text-emerald-400"
          }`}>
            {result.riskScore.toFixed(0)}
            <span className="text-xl font-bold text-slate-400">%</span>
          </div>
          <div className="text-xs text-slate-500 uppercase tracking-widest font-mono mt-0.5">
            Risk Score
          </div>
          {/* Visual bar */}
          <div className="mt-1.5 h-1.5 w-24 ml-auto rounded-full bg-slate-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                result.riskScore > 70 ? "bg-red-500" : result.riskScore > 30 ? "bg-yellow-400" : "bg-emerald-500"
              }`}
              style={{ width: `${result.riskScore}%` }}
            />
          </div>
        </div>
      </div>

      {/* ── Model Breakdown ───────────────────────────── */}
      <div className="p-4 bg-[hsl(222,47%,5%)] space-y-3">
        <div className="grid grid-cols-2 gap-3">
          {/* Hybrid Layer */}
          <div className={`rounded-lg border-2 p-3.5 ${
            hybridMalicious
              ? "border-red-500/40 bg-red-950/30"
              : "border-emerald-600/35 bg-emerald-950/20"
          }`}>
            <div className="flex items-center gap-2 mb-2.5">
              <Network className="h-4 w-4 text-blue-400 shrink-0" />
              <span className="text-xs font-black uppercase tracking-widest text-slate-300">
                Hybrid
              </span>
            </div>
            <p className="text-[10px] font-mono text-slate-600 mb-2">XGBoost + MiniLM</p>

            <div className="flex items-center gap-2 mb-2">
              {hybridMalicious
                ? <CircleX className="h-4 w-4 text-red-400 shrink-0" />
                : <CircleCheck className="h-4 w-4 text-emerald-400 shrink-0" />
              }
              <span className={`text-sm font-black tracking-wider ${hybridMalicious ? "text-red-400" : "text-emerald-400"}`}>
                {hybridMalicious ? "MALICIOUS" : "SAFE"}
              </span>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 font-mono">Risk</span>
                <span className="font-mono font-black tabular-nums text-white">{hybridRisk.toFixed(1)}%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${hybridMalicious ? "bg-red-500" : "bg-emerald-500"}`}
                  style={{ width: `${hybridRisk}%` }}
                />
              </div>
            </div>
          </div>

          {/* ML Layer */}
          <div className={`rounded-lg border-2 p-3.5 ${
            mlDangerous
              ? "border-red-500/40 bg-red-950/30"
              : "border-emerald-600/35 bg-emerald-950/20"
          }`}>
            <div className="flex items-center gap-2 mb-2.5">
              <BrainCircuit className="h-4 w-4 text-purple-400 shrink-0" />
              <span className="text-xs font-black uppercase tracking-widest text-slate-300">
                ML Layer
              </span>
            </div>
            <p className="text-[10px] font-mono text-slate-600 mb-2">DeBERTa-v3</p>

            <div className="flex items-center gap-2 mb-2">
              {mlDangerous
                ? <CircleX className="h-4 w-4 text-red-400 shrink-0" />
                : <CircleCheck className="h-4 w-4 text-emerald-400 shrink-0" />
              }
              <span className={`text-sm font-black tracking-wider ${mlDangerous ? "text-red-400" : "text-emerald-400"}`}>
                {result.mlStatus}
              </span>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 font-mono">Confidence</span>
                <span className="font-mono font-black tabular-nums text-white">{mlConfidencePct.toFixed(1)}%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${mlDangerous ? "bg-red-500" : "bg-emerald-500"}`}
                  style={{ width: `${mlConfidencePct}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Weighted blend formula */}
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700/50">
          <GitMerge className="h-3.5 w-3.5 text-blue-400 shrink-0" />
          <span className="text-xs font-mono text-slate-500">
            score = 0.6 × <span className="text-blue-400 font-bold">{hybridRisk.toFixed(1)}%</span>
            {" "}+ 0.4 × <span className="text-purple-400 font-bold">{mlDangerous ? mlConfidencePct.toFixed(1) : "0.0"}%</span>
            {" "}={" "}
            <span className={`font-black ${isBlock ? "text-red-400" : "text-emerald-400"}`}>
              {result.riskScore.toFixed(1)}%
            </span>
          </span>
          <ShieldAlert className="h-3.5 w-3.5 text-slate-600 shrink-0 ml-auto" />
        </div>

        {/* Explanation */}
        <div className="rounded-lg border border-slate-700/60 bg-[hsl(222,47%,4%)] px-4 py-3 text-xs font-mono text-slate-400 leading-relaxed">
          {result.explanation}
        </div>
      </div>
    </div>
  );
}
