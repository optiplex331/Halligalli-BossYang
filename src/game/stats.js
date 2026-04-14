function toLocalDateStr(ts) {
  const d = ts !== undefined ? new Date(ts) : new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function prevDayStr(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - 1);
  return toLocalDateStr(dt.getTime());
}

export function bucketByDay(history) {
  const result = {};
  for (const entry of history) {
    const day = toLocalDateStr(entry.ts);
    if (!result[day]) result[day] = [];
    result[day].push(entry);
  }
  return result;
}

export function computeStreak(history) {
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

export function computeDailyGoalStreak(history, targetRounds) {
  const bucketed = bucketByDay(history);
  const qualifyingDays = Object.entries(bucketed)
    .filter(([, entries]) => entries.length >= targetRounds)
    .map(([day]) => day)
    .sort();
  if (qualifyingDays.length === 0) return 0;
  let streak = 1;
  for (let i = qualifyingDays.length - 1; i > 0; i--) {
    if (prevDayStr(qualifyingDays[i]) === qualifyingDays[i - 1]) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

export function computeRollingAccuracy(history, days) {
  const bucketed = bucketByDay(history);
  const result = [];
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

export function computeReactionTrend(history, days) {
  const bucketed = bucketByDay(history);
  const result = [];
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
