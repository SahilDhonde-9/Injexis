import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Key, Cpu, Globe, CheckCircle2, AlertCircle, Save,
  ShieldCheck, Zap, Radio, Activity,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const PROVIDERS = [
  { id: "openai",  label: "OpenAI",  hint: "gpt-4o-mini",                 defaultModel: "gpt-4o-mini",             defaultBase: null },
  { id: "groq",   label: "Groq",    hint: "llama-3.3-70b-versatile",     defaultModel: "llama-3.3-70b-versatile", defaultBase: null },
  { id: "gemini", label: "Gemini",  hint: "gemini-2.0-flash",            defaultModel: "gemini-2.0-flash",        defaultBase: null },
  { id: "custom", label: "Custom",  hint: "your model name",             defaultModel: "",                        defaultBase: "" },
] as const;

const DETECTION_RULES = [
  { id: "direct",     label: "Direct Injection",    description: "Explicit prompt override attempts" },
  { id: "indirect",   label: "Indirect Injection",  description: "Context manipulation via external data" },
  { id: "obfuscated", label: "Obfuscated Injection", description: "Base64, unicode and encoding tricks" },
  { id: "encoding",   label: "Encoding Evasion",    description: "Character substitution & homoglyphs" },
  { id: "jailbreak",  label: "Jailbreak Attempts",  description: "Role-play and DAN-style bypasses" },
  { id: "privilege",  label: "Privilege Escalation",description: "Attempts to gain system-level access" },
];

const schema = z.object({
  provider: z.enum(["openai", "groq", "gemini", "custom"]),
  apiKey: z.string().min(1, "API key required"),
  model: z.string().min(1, "Model required"),
  baseUrl: z.string().nullable().optional(),
});
type FormValues = z.infer<typeof schema>;

export default function SettingsPage() {
  const [activeProvider, setActiveProvider] = useState<"openai" | "groq" | "gemini" | "custom">("openai");
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [currentSettings, setCurrentSettings] = useState<{ provider: string; model: string; hasApiKey: boolean } | null>(null);
  const [rules, setRules] = useState<Record<string, boolean>>(
    Object.fromEntries(DETECTION_RULES.map((r) => [r.id, true]))
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { provider: "openai", apiKey: "", model: "gpt-4o-mini", baseUrl: null },
  });

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setCurrentSettings(d);
          setActiveProvider(d.provider);
          form.setValue("provider", d.provider);
          form.setValue("model", d.model);
          if (d.baseUrl) form.setValue("baseUrl", d.baseUrl);
        }
      })
      .catch(() => {});
  }, [form]);

  function selectProvider(id: typeof activeProvider) {
    setActiveProvider(id);
    form.setValue("provider", id);
    const p = PROVIDERS.find((p) => p.id === id)!;
    if (p.defaultModel) form.setValue("model", p.defaultModel);
    form.setValue("baseUrl", p.defaultBase);
    setSaved(false);
    setSaveError(null);
  }

  async function onSubmit(values: FormValues) {
    setIsSaving(true);
    setSaved(false);
    setSaveError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const err = await res.json();
        setSaveError(err.error ?? "Save failed");
      } else {
        const d = await res.json();
        setCurrentSettings(d);
        setSaved(true);
        form.setValue("apiKey", "");
        setTimeout(() => setSaved(false), 4000);
      }
    } catch {
      setSaveError("Network error — check your connection");
    } finally {
      setIsSaving(false);
    }
  }

  const showBaseUrl = activeProvider === "custom";

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-black tracking-tight text-white">Settings</h2>
        <p className="text-base text-slate-400 mt-0.5">Configure LLM provider and detection rules</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* ── Left: LLM Config ─────────────────────── */}
        <div className="xl:col-span-7 space-y-5">
          {/* Provider card */}
          <div className="rounded-xl border-2 border-slate-700/60 bg-[hsl(222,47%,5%)] overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-700/50 flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-blue-500/30 bg-blue-500/15">
                <Cpu className="h-4 w-4 text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-white uppercase tracking-wider">LLM Provider</p>
                {currentSettings && (
                  <p className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest">
                    {currentSettings.provider} active · {currentSettings.model}
                  </p>
                )}
              </div>
            </div>

            <div className="p-5 space-y-5">
              {/* Provider selector */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {PROVIDERS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => selectProvider(p.id)}
                    className={`px-3 py-3 rounded-xl text-sm font-bold transition-all border-2 ${
                      activeProvider === p.id
                        ? "bg-blue-500/15 border-blue-500/50 text-blue-300 shadow-[0_0_16px_rgba(59,130,246,0.2)]"
                        : "border-slate-700/60 text-slate-500 hover:border-slate-600 hover:text-slate-300 bg-slate-800/30"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="apiKey"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-widest text-slate-500">
                          <Key className="h-3 w-3" /> API Key
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder={
                              currentSettings?.hasApiKey
                                ? "•••••••••••• (saved — leave blank to keep)"
                                : "Enter your API key"
                            }
                            className="font-mono bg-[hsl(222,47%,3%)] border-2 border-slate-700 focus-visible:border-blue-500 focus-visible:ring-0 text-slate-100 h-11"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="model"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-widest text-slate-500">
                          <Zap className="h-3 w-3" /> Model
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder={PROVIDERS.find((p) => p.id === activeProvider)?.hint ?? "Model name"}
                            className="font-mono bg-[hsl(222,47%,3%)] border-2 border-slate-700 focus-visible:border-blue-500 focus-visible:ring-0 text-slate-100 h-11"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {showBaseUrl && (
                    <FormField
                      control={form.control}
                      name="baseUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-widest text-slate-500">
                            <Globe className="h-3 w-3" /> Base URL
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="https://your-endpoint.com/v1"
                              className="font-mono bg-[hsl(222,47%,3%)] border-2 border-slate-700 focus-visible:border-blue-500 focus-visible:ring-0 text-slate-100 h-11"
                              value={field.value ?? ""}
                              onChange={field.onChange}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <div className="pt-1 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm transition-all shadow-[0_0_20px_rgba(59,130,246,0.25)]"
                    >
                      {isSaving ? (
                        <span className="animate-pulse">Saving…</span>
                      ) : (
                        <><Save className="h-4 w-4" /> Save Settings</>
                      )}
                    </button>
                    {saved && (
                      <span className="flex items-center gap-1.5 text-sm text-emerald-400 font-mono">
                        <CheckCircle2 className="h-4 w-4" /> Saved
                      </span>
                    )}
                    {saveError && (
                      <span className="flex items-center gap-1.5 text-sm text-red-400 font-mono">
                        <AlertCircle className="h-4 w-4" /> {saveError}
                      </span>
                    )}
                  </div>
                </form>
              </Form>
            </div>
          </div>

          {/* Engine status */}
          <div className="rounded-xl border-2 border-slate-700/60 bg-[hsl(222,47%,5%)] overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-700/50 flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10">
                <Radio className="h-4 w-4 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-white uppercase tracking-wider">Engine Status</p>
              </div>
              <span className="ml-auto px-2 py-1 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-widest">
                Online
              </span>
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { label: "Detection Engine", value: "Hybrid AI + Heuristics", color: "text-blue-400" },
                { label: "Sensitivity Level", value: "High", color: "text-yellow-400" },
                { label: "Heuristic Rules", value: "v4.2.1", color: "text-purple-400" },
                { label: "ML Classifier", value: "DeBERTa-v3 (Active)", color: "text-emerald-400" },
              ].map((item) => (
                <div key={item.label} className="flex justify-between items-center px-4 py-3 rounded-lg bg-slate-800/40 border border-slate-700/50">
                  <span className="text-xs text-slate-500 font-mono">{item.label}</span>
                  <span className={`text-xs font-mono font-bold ${item.color}`}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right: Detection Rules + System Health ── */}
        <div className="xl:col-span-5 space-y-5">
          {/* Detection rules */}
          <div className="rounded-xl border-2 border-slate-700/60 bg-[hsl(222,47%,5%)] overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-700/50 flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-blue-500/30 bg-blue-500/15">
                <ShieldCheck className="h-4 w-4 text-blue-400" />
              </div>
              <p className="text-sm font-bold text-white uppercase tracking-wider">Detection Rules</p>
              <span className="ml-auto text-[10px] font-mono text-slate-600">
                {Object.values(rules).filter(Boolean).length}/{DETECTION_RULES.length} active
              </span>
            </div>
            <div className="p-4 space-y-2">
              {DETECTION_RULES.map((rule) => (
                <div
                  key={rule.id}
                  className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border-2 transition-all ${
                    rules[rule.id]
                      ? "border-blue-500/25 bg-blue-500/5"
                      : "border-slate-700/50 bg-slate-800/20"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold ${rules[rule.id] ? "text-white" : "text-slate-500"}`}>
                      {rule.label}
                    </p>
                    <p className="text-[11px] text-slate-600 truncate">{rule.description}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[10px] font-mono font-black ${rules[rule.id] ? "text-blue-400" : "text-slate-700"}`}>
                      {rules[rule.id] ? "ON" : "OFF"}
                    </span>
                    <Switch
                      checked={rules[rule.id] ?? true}
                      onCheckedChange={(v) => setRules((r) => ({ ...r, [rule.id]: v }))}
                      className="data-[state=checked]:bg-blue-500"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* System health */}
          <div className="rounded-xl border-2 border-slate-700/60 bg-[hsl(222,47%,5%)] overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-700/50 flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-purple-500/30 bg-purple-500/10">
                <Activity className="h-4 w-4 text-purple-400" />
              </div>
              <p className="text-sm font-bold text-white uppercase tracking-wider">System Health</p>
            </div>
            <div className="p-5 space-y-4">
              {[
                { label: "Hybrid Layer (HF)", value: 100, color: "bg-emerald-500", glow: "shadow-[0_0_8px_rgba(16,185,129,0.5)]" },
                { label: "ML Layer (HF)",     value: 100, color: "bg-emerald-500", glow: "shadow-[0_0_8px_rgba(16,185,129,0.5)]" },
                { label: "Database",          value: 100, color: "bg-blue-500",    glow: "shadow-[0_0_8px_rgba(59,130,246,0.5)]" },
              ].map((item) => (
                <div key={item.label} className="space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 font-mono">{item.label}</span>
                    <span className="font-mono font-black text-emerald-400">OK</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${item.color} ${item.glow}`}
                      style={{ width: `${item.value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
