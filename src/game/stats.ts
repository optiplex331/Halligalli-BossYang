import type { HistoryEntry, TrendPoint } from "./types.js";

function toLocalDateStr(ts?: number) {
  const d = ts !== undefined ? new Date(ts) : new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function prevDayStr(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (y === undefined || m === undefined || d === undefined) {
    return dateStr;
  }
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - 1);
  return toLocalDateStr(dt.getTime());
}

export function bucketByDay(history: readonly HistoryEntry[]): Record<string, HistoryEntry[]> {
  const result: Record<string, HistoryEntry[]> = {};
  for (const entry of history) {
    const day = toLocalDateStr(entry.ts);
    result[day] ??= [];
    result[day].push(entry);
  }
  return result;
}

export function computeStreak(history: readonly HistoryEntry[]) {
  const bucketed = bucketByDay(history);
  const today = toLocalDateStr();
  let streak = 0;
  let current = today;
  while (bucketed[current]) {
    streak++;
    current = prevDayStr(current);
  }
  return streak;
}

export function computeDailyGoalStreak(history: readonly HistoryEntry[], targetRounds: number) {
  const bucketed = bucketByDay(history);
  const qualifyingDays = Object.entries(bucketed)
    .filter(([, entries]) => entries.length >= targetRounds)
    .map(([day]) => day)
    .sort();
  if (qualifyingDays.length === 0) return 0;
  let streak = 1;
  for (let i = qualifyingDays.length - 1; i > 0; i--) {
    const current = qualifyingDays[i];
    const previous = qualifyingDays[i - 1];
    if (current !== undefined && previous !== undefined && prevDayStr(current) === previous) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

export function computeRollingAccuracy(
  history: readonly HistoryEntry[],
  days: number,
): TrendPoint[] {
  const bucketed = bucketByDay(history);
  const result: TrendPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const date = toLocalDateStr(d.getTime());
    const entries = bucketed[date];
    if (entries && entries.length > 0) {
      const avg = entries.reduce((sum, e) => sum + e.accuracy, 0) / entries.length;
      result.push({ date, value: Math.round(avg * 100) });
    } else {
      result.push({ date, value: null });
    }
  }
  return result;
}

export function computeReactionTrend(
  history: readonly HistoryEntry[],
  days: number,
): TrendPoint[] {
  const bucketed = bucketByDay(history);
  const result: TrendPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const date = toLocalDateStr(d.getTime());
    const entries = (bucketed[date] ?? []).filter((e) => e.avgReactionMs > 0);
    if (entries.length > 0) {
      const avg = entries.reduce((sum, e) => sum + e.avgReactionMs, 0) / entries.length;
      result.push({ date, value: Math.round(avg) });
    } else {
      result.push({ date, value: null });
    }
  }
  return result;
}
