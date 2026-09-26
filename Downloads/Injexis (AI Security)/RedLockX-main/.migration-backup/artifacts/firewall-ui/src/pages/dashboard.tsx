import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  useGetStats,
  useGetAttackTypeBreakdown,
  useGetRecentActivity,
  getGetStatsQueryKey,
  getGetAttackTypeBreakdownQueryKey,
  getGetRecentActivityQueryKey,
} from "@workspace/api-client-react";
import {
  Shield, ShieldAlert, Activity, BarChart3,
  TrendingUp, Percent, RefreshCw, Cpu, Lock,
  AlertTriangle, CheckCircle, Zap, Clock, Home,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer,
  Tooltip, XAxis, YAxis, Cell,
} from "recharts";

const ATTACK_COLORS = ["#ef4444","#f97316","#eab308","#3b82f6","#8b5cf6","#06b6d4"];
const POLL_MS = 30_000;

function fmtDate(iso: string) {
  const [, m, d] = iso.split("-");
  const months = ["","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[parseInt(m, 10)]} ${parseInt(d, 10)}`;
}
function fmtDateLong(iso: string) {
  const [yr, m, d] = iso.split("-");
  const months = ["","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[parseInt(m, 10)]} ${parseInt(d, 10)}, ${yr}`;
}
function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
function redactPrompt(p: string) {
  if (p.length <= 40) return p;
  return p.slice(0, 38) + "…";
}
function threatLevel(blockRate: number): { label: string; color: string; ring: string } {
  if (blockRate >= 60) return { label: "CRITICAL", color: "#ef4444", ring: "border-red-500/60" };
  if (blockRate >= 35) return { label: "HIGH",     color: "#f97316", ring: "border-orange-500/60" };
  if (blockRate >= 15) return { label: "MEDIUM",   color: "#eab308", ring: "border-yellow-500/60" };
  return                       { label: "LOW",      color: "#10b981", ring: "border-emerald-500/60" };
}

// ── Radial Gauge ─────────────────────────────────────────────────────────────
function RadialGauge({ value, max = 100 }: { value: number; max?: number }) {
  const pct = Math.min(1, value / max);
  const R = 54, CX = 70, CY = 70;
  const startAngle = -210, sweep = 240;
  const angle = startAngle + sweep * pct;

  function polar(cx: number, cy: number, r: number, deg: number) {
    const rad = (deg * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }
  function arc(cx: number, cy: number, r: number, start: number, end: number) {
    const s = polar(cx, cy, r, start);
    const e = polar(cx, cy, r, end);
    const large = Math.abs(end - start) > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
  }

  const { label, color } = threatLevel(value);
  const tip = polar(CX, CY, R - 6, angle);

  return (
    <div className="flex flex-col items-center justify-center gap-2">
      <svg width="140" height="110" viewBox="0 0 140 110">
        {/* track */}
        <path d={arc(CX, CY, R, -210, 30)} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" strokeLinecap="round" />
        {/* fill */}
        {pct > 0 && (
          <path d={arc(CX, CY, R, -210, angle)} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 6px ${color}88)` }} />
        )}
        {/* needle dot */}
        <circle cx={tip.x} cy={tip.y} r="5" fill={color} style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
        {/* center value */}
        <text x={CX} y={CY + 8} textAnchor="middle" fill="white" fontSize="22" fontWeight="900" fontFamily="monospace">
          {value.toFixed(0)}%
        </text>
      </svg>
      <div className="flex flex-col items-center gap-0.5">
        <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Threat Level</span>
        <span className="text-sm font-black tracking-wider" style={{ color }}>{label}</span>
      </div>
    </div>
  );
}

// ── Live Threat Feed ──────────────────────────────────────────────────────────
interface ThreatLog {
  id: number;
  prompt: string;
  attackType: string | null;
  riskScore: number;
  mlConfidence: number;
  createdAt: string;
}

function useLiveFeed(pollMs: number) {
  const [logs, setLogs] = useState<ThreatLog[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const res = await fetch("/api/logs?limit=6");
      if (!res.ok) return;
      const data = await res.json();
      setLogs(
        (data.logs as ThreatLog[])
          .filter((l) => l.attackType)
          .slice(0, 5)
      );
    } catch { /* silent */ }
    finally { setLoading(false); }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, pollMs);
    return () => clearInterval(id);
  }, []);

  return { logs, loading, reload: load };
}

const ATTACK_BADGE: Record<string, string> = {
  direct_injection:          "bg-red-500/15 text-red-300 border-red-500/30",
  jailbreak_attempt:         "bg-orange-500/15 text-orange-300 border-orange-500/30",
  system_prompt_extraction:  "bg-purple-500/15 text-purple-300 border-purple-500/30",
  obfuscation_attack:        "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  role_manipulation:         "bg-pink-500/15 text-pink-300 border-pink-500/30",
  indirect_injection:        "bg-blue-500/15 text-blue-300 border-blue-500/30",
  code_execution_attempt:    "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  data_exfiltration_attempt: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};
function attackBadgeCls(type: string | null) {
  if (!type) return "bg-slate-700/40 text-slate-400 border-slate-600/40";
  return ATTACK_BADGE[type] ?? "bg-slate-700/40 text-slate-400 border-slate-600/40";
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [, navigate] = useLocation();
  const [lastRefresh, setLastRefresh] = useState(() => new Date());
  const { logs: threatLogs, loading: feedLoading, reload: reloadFeed } = useLiveFeed(POLL_MS);

  const { data: stats, isLoading: isLoadingStats, refetch: refetchStats } = useGetStats({
    query: { queryKey: getGetStatsQueryKey(), refetchInterval: POLL_MS, staleTime: 10_000 },
  });
  const { data: attackTypes, isLoading: isLoadingTypes, refetch: refetchTypes } = useGetAttackTypeBreakdown({
    query: { queryKey: getGetAttackTypeBreakdownQueryKey(), refetchInterval: POLL_MS, staleTime: 10_000 },
  });
  const { data: activity, isLoading: isLoadingActivity, refetch: refetchActivity } = useGetRecentActivity({
    query: { queryKey: getGetRecentActivityQueryKey(), refetchInterval: POLL_MS, staleTime: 10_000 },
  });

  function handleRefresh() {
    refetchStats(); refetchTypes(); refetchActivity(); reloadFeed();
    setLastRefresh(new Date());
  }

  const activityData = Array.isArray(activity) ? activity : [];
  const hasActivity = activityData.some((d) => d.analyzed > 0);
  const blockRate = stats?.blockRate ?? 0;
  const { label: threatLabel, color: threatColor, ring: threatRing } = threatLevel(blockRate);
  const securityScore = Math.max(0, Math.round(100 - blockRate * 0.7 - (stats?.avgRiskScore ?? 0) * 0.2));

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="relative rounded-xl border border-slate-700/60 bg-gradient-to-r from-slate-900 via-slate-800/80 to-slate-900 overflow-hidden">
        {/* Subtle grid overlay */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "linear-gradient(hsl(215,100%,60%) 1px,transparent 1px),linear-gradient(90deg,hsl(215,100%,60%) 1px,transparent 1px)", backgroundSize: "40px 40px" }} />
        {/* Left glow accent */}
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-500/80 via-purple-500/60 to-transparent rounded-l-xl" />

        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-5 py-4">
          {/* Left: brand + title */}
          <div className="flex items-center gap-4">
            <div className="relative flex-shrink-0">
              <img src="/redlock-logo.png" alt="RedLockX" className="h-10 w-10 object-contain" style={{ filter: "drop-shadow(0 0 10px rgba(220,30,30,0.5))" }} />
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-slate-900 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white leading-none">Dashboard</h2>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-blue-500/15 text-blue-400 border border-blue-500/25">LIVE</span>
                <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded border text-[11px] font-mono font-bold tracking-widest ${threatRing} bg-slate-900/60`}>
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: threatColor }} />
                  <span style={{ color: threatColor }}>{threatLabel}</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 font-mono mt-1">
                RedLockX · Prompt Injection Firewall ·{" "}
                <span className="text-slate-600">refreshed {lastRefresh.toLocaleTimeString()}</span>
              </p>
            </div>
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Mini stat pills */}
            <div className="hidden lg:flex items-center gap-2 mr-2">
              <span className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-[11px] font-mono text-slate-300">
                <span className="text-white font-bold">{stats?.totalAnalyzed ?? "—"}</span> analyzed
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-[11px] font-mono text-slate-300">
                <span className="text-red-400 font-bold">{stats?.totalBlocked ?? "—"}</span> blocked
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-[11px] font-mono text-slate-300">
                <span className="text-yellow-400 font-bold">{stats?.blockRate != null ? `${stats.blockRate.toFixed(1)}%` : "—"}</span> rate
              </span>
            </div>

            <button onClick={() => navigate("/")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/60 hover:border-blue-500/50 hover:bg-blue-500/10 text-slate-400 hover:text-white transition-all text-xs font-mono">
              <Home className="h-3 w-3" />
              <span>Home</span>
            </button>
            <button onClick={handleRefresh}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/60 hover:border-blue-500/50 hover:bg-blue-500/10 text-slate-400 hover:text-white transition-all text-xs font-mono">
              <RefreshCw className="h-3 w-3" />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="Total Analyzed" value={stats?.totalAnalyzed} sub={`${stats?.todayAnalyzed ?? 0} today`}
          loading={isLoadingStats} icon={<Activity className="h-4 w-4 text-blue-400" />} accent="blue" />
        <StatCard title="Total Blocked" value={stats?.totalBlocked} sub={`${stats?.todayBlocked ?? 0} today`}
          loading={isLoadingStats} icon={<ShieldAlert className="h-4 w-4 text-red-400" />} accent="red" />
        <StatCard title="Block Rate" value={stats?.blockRate != null ? `${stats.blockRate.toFixed(1)}%` : "0%"}
          sub={`${stats?.totalAllowed ?? 0} safe passed`}
          loading={isLoadingStats} icon={<Percent className="h-4 w-4 text-yellow-400" />} accent="yellow" />
        <StatCard title="Security Score" value={isLoadingStats ? undefined : `${securityScore}`}
          sub="composite safety index"
          loading={isLoadingStats} icon={<Shield className="h-4 w-4 text-purple-400" />} accent="purple" />
      </div>

      {/* ── Row 2: Traffic + Threat Gauge ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Traffic chart */}
        <div className="lg:col-span-2 rounded-xl border border-slate-700/60 bg-[hsl(222,47%,4%)] overflow-hidden">
          <div className="px-5 pt-4 pb-3 border-b border-slate-700/40 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-white">Traffic Analysis</p>
              <p className="text-[11px] text-slate-500 font-mono">Last 7 days · allowed vs blocked</p>
            </div>
            <div className="flex items-center gap-4 text-[11px] font-mono">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />Allowed
              </span>
              <span className="flex items-center gap-1.5 text-red-400">
                <span className="w-2.5 h-2.5 rounded-sm bg-red-500" />Blocked
              </span>
            </div>
          </div>
          <div className="p-4 h-[240px]">
            {isLoadingActivity ? <Skeleton className="w-full h-full rounded-lg bg-slate-800/50" /> :
            hasActivity ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activityData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }} barCategoryGap="28%" barGap={3}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="date" tickFormatter={fmtDate} stroke="#334155"
                    tick={{ fill: "#64748b", fontSize: 11, fontFamily: "monospace" }} tickLine={false} axisLine={false} />
                  <YAxis stroke="#334155" tick={{ fill: "#64748b", fontSize: 11, fontFamily: "monospace" }}
                    tickLine={false} axisLine={false} allowDecimals={false} width={28} />
                  <Tooltip cursor={{ fill: "rgba(255,255,255,0.03)", radius: 4 }}
                    contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #1e293b", borderRadius: "10px", fontSize: "12px", padding: "10px 14px" }}
                    itemStyle={{ color: "#e2e8f0", fontFamily: "monospace" }}
                    labelStyle={{ color: "#94a3b8", marginBottom: "6px", fontFamily: "monospace", fontSize: "11px" }}
                    labelFormatter={(v: string) => fmtDateLong(v)} />
                  <Bar dataKey="allowed" name="Allowed" fill="#10b981" radius={[3,3,0,0]} maxBarSize={28} />
                  <Bar dataKey="blocked" name="Blocked" fill="#ef4444" radius={[3,3,0,0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col h-full items-center justify-center gap-2">
                <BarChart3 className="h-8 w-8 text-slate-700" />
                <p className="text-slate-500 text-xs font-mono">No activity yet — analyze a prompt to start</p>
              </div>
            )}
          </div>
        </div>

        {/* Threat Gauge */}
        <div className="rounded-xl border border-slate-700/60 bg-[hsl(222,47%,4%)] overflow-hidden">
          <div className="px-5 pt-4 pb-3 border-b border-slate-700/40">
            <p className="text-sm font-bold text-white">Threat Level</p>
            <p className="text-[11px] text-slate-500 font-mono">Real-time risk assessment</p>
          </div>
          <div className="flex flex-col h-[240px] items-center justify-center gap-1 px-4">
            {isLoadingStats ? <Skeleton className="w-36 h-36 rounded-full bg-slate-800/50" /> : (
              <RadialGauge value={blockRate} />
            )}
            <div className="w-full mt-2 grid grid-cols-2 gap-2 text-center">
              <div className="rounded-lg bg-slate-800/50 border border-slate-700/40 p-2">
                <p className="text-[10px] text-slate-500 font-mono uppercase">Avg Risk</p>
                <p className="text-base font-black text-white font-mono">{(stats?.avgRiskScore ?? 0).toFixed(1)}</p>
              </div>
              <div className="rounded-lg bg-slate-800/50 border border-slate-700/40 p-2">
                <p className="text-[10px] text-slate-500 font-mono uppercase">Safe Score</p>
                <p className="text-base font-black text-emerald-400 font-mono">{securityScore}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Row 3: Attack Vectors + Live Threat Feed ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Attack Vectors */}
        <div className="rounded-xl border border-slate-700/60 bg-[hsl(222,47%,4%)] overflow-hidden">
          <div className="px-5 pt-4 pb-3 border-b border-slate-700/40">
            <p className="text-sm font-bold text-white">Attack Vectors</p>
            <p className="text-[11px] text-slate-500 font-mono">Blocked payload distribution</p>
          </div>
          <div className="p-4 h-[240px]">
            {isLoadingTypes ? <Skeleton className="w-full h-full rounded-lg bg-slate-800/50" /> :
            Array.isArray(attackTypes) && attackTypes.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={attackTypes} layout="vertical" margin={{ top: 0, right: 8, left: 4, bottom: 0 }} barSize={12}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.03)" />
                  <XAxis type="number" tick={{ fill: "#475569", fontSize: 10, fontFamily: "monospace" }}
                    tickLine={false} axisLine={false} allowDecimals={false} />
                  <YAxis dataKey="attackType" type="category" axisLine={false} tickLine={false}
                    tick={{ fill: "#64748b", fontSize: 9, fontFamily: "monospace" }} width={82}
                    tickFormatter={(v: string) => v.replace(/_/g, " ")} />
                  <Tooltip cursor={{ fill: "rgba(255,255,255,0.03)" }}
                    contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #1e293b", borderRadius: "10px", fontSize: "12px", padding: "8px 12px" }}
                    itemStyle={{ color: "#e2e8f0", fontFamily: "monospace" }}
                    labelStyle={{ color: "#94a3b8", fontSize: "10px", fontFamily: "monospace" }}
                    labelFormatter={(v: string) => v.replace(/_/g, " ")}
                    formatter={(v: number) => [`${v} detections`, ""]} />
                  <Bar dataKey="count" radius={[0,4,4,0]}>
                    {attackTypes.map((_, i) => <Cell key={i} fill={ATTACK_COLORS[i % ATTACK_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col h-full items-center justify-center gap-2">
                <Shield className="h-8 w-8 text-slate-700" />
                <p className="text-slate-500 text-xs font-mono">No attacks blocked yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Live Threat Feed */}
        <div className="lg:col-span-2 rounded-xl border border-slate-700/60 bg-[hsl(222,47%,4%)] overflow-hidden">
          <div className="px-5 pt-4 pb-3 border-b border-slate-700/40 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-white flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                </span>
                Live Threat Feed
              </p>
              <p className="text-[11px] text-slate-500 font-mono">Most recent blocked prompts</p>
            </div>
            <span className="text-[10px] font-mono text-slate-600 bg-slate-800/60 border border-slate-700/40 px-2 py-1 rounded">
              auto-refreshes 30s
            </span>
          </div>
          <div className="divide-y divide-slate-800/60">
            {feedLoading ? (
              [...Array(4)].map((_, i) => (
                <div key={i} className="px-5 py-3 flex items-center gap-3">
                  <Skeleton className="h-4 w-4 rounded bg-slate-800" />
                  <Skeleton className="h-3 flex-1 rounded bg-slate-800" />
                  <Skeleton className="h-3 w-16 rounded bg-slate-800" />
                </div>
              ))
            ) : threatLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[200px] gap-2">
                <CheckCircle className="h-8 w-8 text-emerald-700" />
                <p className="text-slate-500 text-xs font-mono">No threats detected yet — feed is clear</p>
              </div>
            ) : (
              threatLogs.map((log) => (
                <div key={log.id} className="px-5 py-3 flex items-start gap-3 hover:bg-slate-800/20 transition-colors">
                  <div className="mt-0.5 flex-none w-7 h-7 rounded-md bg-red-500/10 border border-red-500/25 flex items-center justify-center">
                    <Lock className="h-3.5 w-3.5 text-red-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono text-slate-300 truncate">{redactPrompt(log.prompt)}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {log.attackType && (
                        <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${attackBadgeCls(log.attackType)}`}>
                          {log.attackType.replace(/_/g, " ")}
                        </span>
                      )}
                      <span className="text-[10px] font-mono text-slate-600 flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" />{timeAgo(log.createdAt)}
                      </span>
                    </div>
                  </div>
                  <div className="flex-none text-right">
                    <p className="text-xs font-black font-mono text-red-400">{log.riskScore.toFixed(0)}%</p>
                    <p className="text-[10px] font-mono text-slate-600">risk</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── System Health Strip ── */}
      <div className="rounded-xl border border-slate-700/40 bg-[hsl(222,47%,3%)] px-5 py-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <span className="text-[10px] font-mono text-slate-600 uppercase tracking-widest">System Status</span>
          <div className="flex items-center gap-6 flex-wrap">
            <StatusPill icon={<Zap className="h-3 w-3" />} label="Hybrid Model" ok />
            <StatusPill icon={<Cpu className="h-3 w-3" />} label="DeBERTa-v3 ML" ok />
            <StatusPill icon={<Activity className="h-3 w-3" />} label="Supabase DB" ok />
            <StatusPill icon={<Shield className="h-3 w-3" />} label="Firewall Active" ok />
            <StatusPill icon={<AlertTriangle className="h-3 w-3" />} label="HF Spaces" ok />
          </div>
          <span className="text-[10px] font-mono text-slate-600 hidden lg:block">
            Polls every 30s · {new Date().toLocaleDateString()}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── StatusPill ────────────────────────────────────────────────────────────────
function StatusPill({ icon, label, ok }: { icon: React.ReactNode; label: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={ok ? "text-emerald-400" : "text-red-400"}>{icon}</span>
      <span className="text-[11px] font-mono text-slate-400">{label}</span>
      <span className={`w-1.5 h-1.5 rounded-full ${ok ? "bg-emerald-400" : "bg-red-400"}`} />
    </div>
  );
}

// ── StatCard ──────────────────────────────────────────────────────────────────
type Accent = "blue" | "red" | "yellow" | "purple";
const accentMap: Record<Accent, { border: string; bg: string; text: string; iconBg: string }> = {
  blue:   { border: "border-blue-500/30",   bg: "from-blue-500/6",   text: "text-blue-400",   iconBg: "bg-blue-500/10 border-blue-500/25" },
  red:    { border: "border-red-500/30",    bg: "from-red-500/6",    text: "text-red-400",    iconBg: "bg-red-500/10 border-red-500/25" },
  yellow: { border: "border-yellow-500/25", bg: "from-yellow-500/6", text: "text-yellow-400", iconBg: "bg-yellow-500/10 border-yellow-500/25" },
  purple: { border: "border-purple-500/30", bg: "from-purple-500/6", text: "text-purple-400", iconBg: "bg-purple-500/10 border-purple-500/25" },
};

function StatCard({ title, value, sub, icon, loading, accent }: {
  title: string; value?: number | string; sub?: string;
  icon: React.ReactNode; loading: boolean; accent: Accent;
}) {
  const a = accentMap[accent];
  return (
    <div className={`rounded-xl border ${a.border} bg-gradient-to-br ${a.bg} to-transparent bg-[hsl(222,47%,4%)] p-4 space-y-2`}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">{title}</p>
        <div className={`flex h-7 w-7 items-center justify-center rounded-lg border ${a.iconBg}`}>{icon}</div>
      </div>
      {loading ? <Skeleton className="h-8 w-20 bg-slate-800/60" /> : (
        <p className={`text-2xl font-black font-mono tabular-nums ${a.text}`}>
          {value !== undefined ? value : "—"}
        </p>
      )}
      {sub && <p className="text-[10px] font-mono text-slate-600">{sub}</p>}
    </div>
  );
}
