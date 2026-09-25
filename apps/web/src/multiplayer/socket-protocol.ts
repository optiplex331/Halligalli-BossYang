import type { components } from "./rest.generated.js";

type RoomSnapshot = components["schemas"]["RoomSnapshot"];

export type ServerFrame =
  | { type: "snapshot"; snapshot: RoomSnapshot }
  | { type: "error"; code: string; title: string };

const RECONNECT_BASE_MS = 400;
const RECONNECT_CAP_MS = 5_000;

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
  return null;
}

/** Exponential backoff with equal jitter: half the capped delay is fixed, half is random. */
export function reconnectDelayMs(attempt: number, random: () => number = Math.random): number {
  const ceiling = Math.min(RECONNECT_CAP_MS, RECONNECT_BASE_MS * 2 ** Math.min(attempt, 16));
  return Math.round(ceiling / 2 + random() * (ceiling / 2));
}
