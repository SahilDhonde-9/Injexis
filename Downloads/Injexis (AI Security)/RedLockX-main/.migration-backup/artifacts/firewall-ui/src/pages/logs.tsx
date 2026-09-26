import React, { useState } from "react";
import { format } from "date-fns";
import { useGetLogs } from "@workspace/api-client-react";
import { Shield, ShieldAlert, Eye, ChevronLeft, ChevronRight, Lock, Unlock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import type { LogEntry } from "@workspace/api-client-react/src/generated/api.schemas";

export default function Logs() {
  const [page, setPage] = useState(0);
  const limit = 15;
  const offset = page * limit;

  const { data, isLoading } = useGetLogs(
    { limit, offset },
    { query: { keepPreviousData: true } as any }
  );

  const logs = data?.logs ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-white">Log History</h2>
          <p className="text-base text-slate-400 mt-0.5">Review past analyses and injection attempts</p>
        </div>
        {total > 0 && (
          <div className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/50">
            <span className="text-sm font-mono font-bold text-slate-400">
              {total} <span className="text-slate-600">records</span>
            </span>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border-2 border-slate-700/60 bg-[hsl(222,47%,5%)] overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[100px_1fr_120px_160px_140px_44px] gap-0 px-4 py-3 border-b border-slate-700/60 bg-slate-800/40">
          {["Verdict","Prompt","Risk","Attack Type","Time",""].map((h, i) => (
            <div key={i} className={`text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500 ${i === 4 ? "text-right" : ""}`}>
              {h}
            </div>
          ))}
        </div>

        {/* Rows */}
        <div className="divide-y divide-slate-800/80">
          {isLoading && logs.length === 0
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="grid grid-cols-[100px_1fr_120px_160px_140px_44px] gap-0 px-4 py-3.5 items-center">
                  <Skeleton className="h-6 w-16 bg-slate-800/60 rounded-md" />
                  <Skeleton className="h-4 w-48 bg-slate-800/60 rounded" />
                  <Skeleton className="h-4 w-16 bg-slate-800/60 rounded" />
                  <Skeleton className="h-4 w-24 bg-slate-800/60 rounded" />
                  <Skeleton className="h-4 w-20 bg-slate-800/60 rounded ml-auto" />
                  <div />
                </div>
              ))
            : logs.length === 0
            ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <Shield className="h-12 w-12 text-slate-700" />
                  <p className="text-slate-500 font-mono text-sm">No logs found</p>
                </div>
              )
            : logs.map((log) => <LogRow key={log.id} log={log} />)
          }
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500 font-mono">
            {offset + 1}–{Math.min(offset + limit, total)} of {total}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0 || isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/50 text-sm font-mono text-slate-400 hover:text-white hover:border-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Prev
            </button>
            <span className="px-3 py-1.5 text-sm font-mono text-slate-400">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1 || isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/50 text-sm font-mono text-slate-400 hover:text-white hover:border-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Next <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function LogRow({ log }: { log: LogEntry }) {
  const isBlock = log.verdict === "BLOCK";
  return (
    <div className={`group grid grid-cols-[100px_1fr_120px_160px_140px_44px] gap-0 px-4 py-3.5 items-center hover:bg-slate-800/30 transition-colors ${
      isBlock ? "border-l-2 border-l-red-500/50" : "border-l-2 border-l-transparent"
    }`}>
      {/* Verdict */}
      <div>
        {isBlock ? (
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-red-500/15 border border-red-500/30 text-xs font-mono font-bold text-red-400">
            <ShieldAlert className="h-3 w-3" /> BLOCK
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/25 text-xs font-mono font-bold text-emerald-400">
            <Shield className="h-3 w-3" /> ALLOW
          </span>
        )}
      </div>

      {/* Prompt */}
      <div className="font-mono text-xs text-slate-400 truncate pr-4 max-w-[320px]">
        {log.prompt}
      </div>

      {/* Risk */}
      <div className="flex items-center gap-2">
        <span className={`font-mono text-xs font-bold tabular-nums ${
          log.riskScore > 70 ? "text-red-400" : log.riskScore > 30 ? "text-yellow-400" : "text-emerald-400"
        }`}>
          {log.riskScore.toFixed(0)}%
        </span>
        <div className="w-14 h-1.5 rounded-full bg-slate-800 overflow-hidden">
          <div
            className={`h-full rounded-full ${log.riskScore > 70 ? "bg-red-500" : log.riskScore > 30 ? "bg-yellow-400" : "bg-emerald-500"}`}
            style={{ width: `${log.riskScore}%` }}
          />
        </div>
      </div>

      {/* Attack type */}
      <div>
        {log.attackType ? (
          <span className="text-xs font-mono text-orange-300/80 uppercase tracking-wide">
            {log.attackType.replace(/_/g, " ")}
          </span>
        ) : (
          <span className="text-xs text-slate-700 font-mono">—</span>
        )}
      </div>

      {/* Time */}
      <div className="text-xs text-slate-500 font-mono text-right">
        {format(new Date(log.createdAt), "MMM d, HH:mm:ss")}
      </div>

      {/* Detail */}
      <div className="flex justify-end">
        <LogDetailDialog log={log} />
      </div>
    </div>
  );
}

function LogDetailDialog({ log }: { log: LogEntry }) {
  const isBlock = log.verdict === "BLOCK";
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="flex items-center justify-center h-7 w-7 rounded-md border border-slate-700/0 group-hover:border-slate-700 text-slate-700 group-hover:text-slate-400 hover:!text-white hover:!border-slate-500 transition-all">
          <Eye className="h-3.5 w-3.5" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-[580px] border-2 border-slate-700 bg-[hsl(222,47%,5%)] text-white p-0 overflow-hidden">
        {/* Modal header */}
        <div className={`px-6 py-5 border-b border-slate-700/60 ${isBlock ? "bg-red-950/30" : "bg-emerald-950/20"}`}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl border-2 ${
                isBlock ? "border-red-500/50 bg-red-500/15" : "border-emerald-500/40 bg-emerald-500/10"
              }`}>
                {isBlock ? <Lock className="h-5 w-5 text-red-400" /> : <Unlock className="h-5 w-5 text-emerald-400" />}
              </div>
              <div>
                <span className={`text-xl font-black tracking-widest ${isBlock ? "text-red-400" : "text-emerald-400"}`}>
                  {log.verdict}
                </span>
                <DialogDescription className="text-slate-500 font-mono text-xs mt-0">
                  ID #{log.id} · {format(new Date(log.createdAt), "PP pp")}
                </DialogDescription>
              </div>
            </DialogTitle>
          </DialogHeader>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Prompt */}
          <div className="space-y-2">
            <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Original Prompt</p>
            <div className="bg-[hsl(222,47%,3%)] rounded-lg p-4 text-sm font-mono text-slate-300 border border-slate-800 whitespace-pre-wrap max-h-[160px] overflow-y-auto leading-relaxed">
              {log.prompt}
            </div>
          </div>

          {/* Metrics grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Risk Score", value: `${log.riskScore.toFixed(1)}%`, color: log.riskScore > 70 ? "text-red-400" : "text-emerald-400" },
              { label: "Attack Type", value: log.attackType?.replace(/_/g, " ") || "None", color: log.attackType ? "text-orange-300" : "text-slate-500" },
              { label: "Hybrid Risk", value: `${(log.hybridProbability * 100).toFixed(1)}%`, color: "text-blue-400" },
              { label: "ML Confidence", value: `${(log.mlConfidence * 100).toFixed(1)}%`, color: "text-purple-400" },
            ].map((m) => (
              <div key={m.label} className="rounded-lg border border-slate-800 bg-slate-800/30 p-3.5">
                <p className="text-[10px] font-mono uppercase tracking-widest text-slate-600 mb-1">{m.label}</p>
                <p className={`font-mono text-lg font-black ${m.color}`}>{m.value}</p>
              </div>
            ))}
          </div>

          {/* Explanation */}
          <div className="space-y-2">
            <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Analysis Explanation</p>
            <p className="text-sm text-slate-400 leading-relaxed bg-[hsl(222,47%,3%)] rounded-lg p-4 border border-slate-800 font-mono">
              {log.explanation}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
