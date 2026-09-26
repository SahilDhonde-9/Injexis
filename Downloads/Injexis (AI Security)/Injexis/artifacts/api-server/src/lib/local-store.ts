export interface AnalysisLogEntry {
  id: number;
  prompt: string;
  verdict: string;
  riskScore: number;
  isSafe: boolean;
  attackType: string | null;
  hybridProbability: number;
  mlStatus: string;
  mlConfidence: number;
  explanation: string;
  createdAt: string;
}

export interface LlmSettingsEntry {
  provider: "openai" | "groq" | "gemini" | "custom";
  apiKey: string;
  model: string;
  baseUrl: string | null;
}

export interface ChatMessageEntry {
  sessionId: string;
  role: "user" | "assistant" | "system";
  content: string;
  verdict: "BLOCK" | "ALLOW" | null;
  riskScore: number | null;
  isBlocked: boolean;
  blockedReason: string | null;
}

const analysisLogs: AnalysisLogEntry[] = [];
const chatMessages: ChatMessageEntry[] = [];
let llmSettings: LlmSettingsEntry | null = null;
let nextLogId = 1;

export function saveAnalysisLog(log: Omit<AnalysisLogEntry, "id" | "createdAt">): AnalysisLogEntry {
  const record: AnalysisLogEntry = {
    ...log,
    id: nextLogId++,
    createdAt: new Date().toISOString(),
  };
  analysisLogs.unshift(record);
  return record;
}

export function getAnalysisLogs(params: {
  limit: number;
  offset: number;
  verdict?: string;
}): { logs: AnalysisLogEntry[]; total: number } {
  const filtered = params.verdict
    ? analysisLogs.filter((log) => log.verdict === params.verdict)
    : analysisLogs;
  return {
    logs: filtered.slice(params.offset, params.offset + params.limit),
    total: filtered.length,
  };
}

export function getAnalysisLogById(id: number): AnalysisLogEntry | null {
  return analysisLogs.find((log) => log.id === id) ?? null;
}

export function getStats() {
  const totalAnalyzed = analysisLogs.length;
  const totalBlocked = analysisLogs.filter((log) => log.verdict === "BLOCK").length;
  const totalAllowed = analysisLogs.filter((log) => log.verdict === "ALLOW").length;
  const avgRiskScore =
    totalAnalyzed === 0
      ? 0
      : analysisLogs.reduce((sum, log) => sum + log.riskScore, 0) / totalAnalyzed;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayLogs = analysisLogs.filter((log) => new Date(log.createdAt) >= today);
  const todayAnalyzed = todayLogs.length;
  const todayBlocked = todayLogs.filter((log) => log.verdict === "BLOCK").length;
  const blockRate = totalAnalyzed > 0 ? (totalBlocked / totalAnalyzed) * 100 : 0;

  return {
    totalAnalyzed,
    totalBlocked,
    totalAllowed,
    blockRate: Number(blockRate.toFixed(2)),
    avgRiskScore: Number(avgRiskScore.toFixed(2)),
    todayAnalyzed,
    todayBlocked,
  };
}

export function getAttackTypes() {
  const counts = new Map<string, number>();
  for (const log of analysisLogs) {
    if (log.attackType && log.verdict === "BLOCK") {
      counts.set(log.attackType, (counts.get(log.attackType) ?? 0) + 1);
    }
  }
  return Array.from(counts, ([attackType, count]) => ({ attackType, count })).sort(
    (a, b) => b.count - a.count,
  );
}

export function getRecentActivity() {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const grouped = new Map<string, { analyzed: number; blocked: number; allowed: number }>();

  for (const log of analysisLogs) {
    const created = new Date(log.createdAt);
    if (created < sevenDaysAgo) continue;
    const date = created.toISOString().slice(0, 10);
    const entry = grouped.get(date) ?? { analyzed: 0, blocked: 0, allowed: 0 };
    entry.analyzed += 1;
    if (log.verdict === "BLOCK") entry.blocked += 1;
    if (log.verdict === "ALLOW") entry.allowed += 1;
    grouped.set(date, entry);
  }

  return Array.from(grouped.entries())
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function getLlmSettings(): LlmSettingsEntry | null {
  return llmSettings;
}

export function saveLlmSettings(settings: LlmSettingsEntry): LlmSettingsEntry {
  llmSettings = { ...settings };
  return llmSettings;
}

export function saveChatMessages(messages: ChatMessageEntry[]) {
  chatMessages.push(...messages);
}
