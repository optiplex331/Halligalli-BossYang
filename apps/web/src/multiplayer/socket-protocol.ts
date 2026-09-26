import type { components } from "./rest.generated.js";

type RoomSnapshot = components["schemas"]["RoomSnapshot"];

export type ServerFrame =
  | { type: "snapshot"; snapshot: RoomSnapshot }
  | { type: "error"; code: string; title: string }
  | { type: "bell_stale"; revealSequence: number };

const RECONNECT_BASE_MS = 400;
const RECONNECT_CAP_MS = 5_000;
/** Close code a server sends when it restarts on purpose, for example during a rolling deploy. */
export const SERVICE_RESTART_CLOSE_CODE = 1012;
const RESTART_JITTER_MS = 500;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseServerFrame(data: unknown): ServerFrame | null {
  let payload: unknown;
  try {
    payload = JSON.parse(String(data));
  } catch {
    return null;
  }
  if (!isRecord(payload)) return null;
  if (payload.type === "snapshot" && isRecord(payload.snapshot)) {
    return { type: "snapshot", snapshot: payload.snapshot as RoomSnapshot };
  }
  if (payload.type === "error" && typeof payload.code === "string" && typeof payload.title === "string") {
    return { type: "error", code: payload.code, title: payload.title };
  }
  if (payload.type === "bell_stale" && typeof payload.revealSequence === "number") {
    return { type: "bell_stale", revealSequence: payload.revealSequence };
  }
  return null;
}

/** Exponential backoff with equal jitter: half the capped delay is fixed, half is random. */
export function reconnectDelayMs(attempt: number, random: () => number = Math.random): number {
  const ceiling = Math.min(RECONNECT_CAP_MS, RECONNECT_BASE_MS * 2 ** Math.min(attempt, 16));
  return Math.round(ceiling / 2 + random() * (ceiling / 2));
}

/**
 * Plans the next reconnect after a socket closes. A planned server restart (1012) reconnects almost
 * immediately, with jitter so every client does not hit the new replica at once, and does not count
 * as a failure. Any other close backs off from the current attempt.
 */
export function reconnectAfterClose(
  closeCode: number,
  attempt: number,
  random: () => number = Math.random,
): { delayMs: number; nextAttempt: number } {
  if (closeCode === SERVICE_RESTART_CLOSE_CODE) {
    return { delayMs: Math.round(random() * RESTART_JITTER_MS), nextAttempt: 0 };
  }
  return { delayMs: reconnectDelayMs(attempt, random), nextAttempt: attempt + 1 };
}
