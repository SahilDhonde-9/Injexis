import React from "react";
import { Link, useLocation } from "wouter";
import { Terminal, Activity, History, Cpu, Radio, Settings2, Bot, ArrowLeft } from "lucide-react";

const navItems = [
  { href: "/analyzer",  label: "Analyzer",  icon: Terminal },
  { href: "/chat",      label: "Chat",      icon: Bot      },
  { href: "/dashboard", label: "Dashboard", icon: Activity },
  { href: "/logs",      label: "Logs",      icon: History  },
  { href: "/settings",  label: "Settings",  icon: Settings2},
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="relative z-10 flex min-h-screen w-full flex-col md:flex-row">
      {/* ── Desktop Sidebar ─────────────────────── */}
      <aside className="hidden md:flex w-60 border-r border-border/60 bg-[hsl(222,50%,3%)]/90 backdrop-blur-sm flex-col shrink-0">
        {/* Logo block */}
        <div className="px-5 py-6 flex flex-col items-center border-b border-border/60">
          <div className="relative flex items-center justify-center mb-2">
            <img
              src="/redlock-logo.png"
              alt="RedLock"
              className="object-contain"
              style={{ width: 110, height: 110, filter: "drop-shadow(0 0 18px rgba(220,30,30,0.55)) drop-shadow(0 0 6px rgba(220,30,30,0.3))" }}
            />
            <span className="absolute bottom-1 right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-50" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
            </span>
          </div>
          <p className="text-[9px] text-muted-foreground/50 font-mono tracking-[0.2em] uppercase">
            by blackXmask
          </p>
          {/* Back to landing */}
          <Link
            href="/"
            className="mt-3 flex items-center gap-1 text-[10px] font-mono text-muted-foreground/40 hover:text-muted-foreground/80 transition-colors"
          >
            <ArrowLeft className="h-2.5 w-2.5" />
            Home
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
          {navItems.map((item) => {
            const isActive = location === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center gap-3 px-3 py-2.5 rounded-md transition-all duration-200 ${
                  isActive
                    ? "bg-primary/10 text-primary font-medium border border-primary/20 shadow-[0_0_12px_rgba(59,130,246,0.08)]"
                    : "text-muted-foreground hover:bg-white/5 hover:text-foreground border border-transparent"
                }`}
              >
                <Icon className={`h-4 w-4 transition-all ${isActive ? "text-primary" : "group-hover:text-primary/70"}`} />
                <span className="text-sm font-mono tracking-wide">{item.label}</span>
                {isActive && (
                  <span className="ml-auto w-1 h-4 rounded-full bg-primary shadow-[0_0_6px_rgba(59,130,246,0.8)]" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Community logo */}
        <div className="px-4 py-3 border-t border-border/60 flex flex-col items-center gap-2">
          <span className="text-[9px] text-muted-foreground/35 font-mono tracking-[0.18em] uppercase">Community</span>
          <img
            src="/community-logo.avif"
            alt="Community"
            className="h-9 w-auto object-contain opacity-75 hover:opacity-100 transition-opacity"
            style={{ filter: "drop-shadow(0 0 6px rgba(59,130,246,0.15))" }}
          />
        </div>

        {/* Status footer */}
        <div className="px-4 py-3 border-t border-border/60 space-y-1.5">
          <div className="flex items-center gap-2">
            <Radio className="h-3 w-3 text-green-400" />
            <span className="text-[10px] text-muted-foreground/70 font-mono tracking-wider uppercase">Systems Online</span>
          </div>
          <div className="flex items-center gap-2 pl-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary/60 animate-pulse" />
            <span className="text-[9px] text-muted-foreground/40 font-mono">Hybrid · ML · DB</span>
          </div>
        </div>
      </aside>

      {/* ── Main content ────────────────────────── */}
      <main className="flex-1 flex flex-col min-h-screen overflow-hidden relative">
        {/* Top bar */}
        <div className="sticky top-0 z-20 h-10 border-b border-border/40 bg-background/85 backdrop-blur-sm flex items-center px-4 gap-3 shrink-0">
          {/* Mobile: mini logo */}
          <div className="flex md:hidden items-center gap-2">
            <img src="/redlock-logo.png" alt="RedLock" className="h-6 w-6 object-contain opacity-90" />
            <span className="text-xs font-mono text-muted-foreground/60 tracking-widest uppercase">RedLockX</span>
          </div>
          {/* Desktop: full title */}
          <div className="hidden md:flex items-center gap-2">
            <Cpu className="h-3 w-3 text-primary/60" />
            <span className="text-[10px] font-mono text-muted-foreground/50 tracking-widest uppercase">
              RedLock Firewall — Prompt Injection Detection
            </span>
          </div>
          <span className="ml-auto flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[10px] font-mono text-green-400/70">ACTIVE</span>
          </span>
        </div>

        {/* Page content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto w-full">
            {children}
          </div>
        </div>
      </main>

      {/* ── Mobile Bottom Navigation ─────────────── */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t border-border/60 bg-[hsl(222,50%,3%)]/95 backdrop-blur-md">
        <div className="flex items-center justify-around h-14 px-1">
          {navItems.map((item) => {
            const isActive = location === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-lg flex-1 transition-all ${
                  isActive ? "text-primary" : "text-muted-foreground/60"
                }`}
              >
                <Icon className={`h-5 w-5 transition-all ${isActive ? "drop-shadow-[0_0_6px_rgba(59,130,246,0.8)]" : ""}`} />
                <span className="text-[9px] font-mono tracking-wide">{item.label}</span>
                {isActive && <span className="absolute bottom-0 h-0.5 w-8 bg-primary rounded-t-full shadow-[0_0_6px_rgba(59,130,246,0.8)]" />}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
