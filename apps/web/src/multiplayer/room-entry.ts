import { useEffect, useState } from "react";

import type { components } from "./rest.generated.js";

type EntryRequest = components["schemas"]["EntryRequest"];
type EntryResult = components["schemas"]["EntryResult"];
type ProblemDetails = components["schemas"]["ProblemDetails"];

export type RoomSnapshot = components["schemas"]["RoomSnapshot"];

interface RoomSession {
  credential: string;
  roomCode: string;
  snapshot: RoomSnapshot;
}

function createCredential(): string {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function credentialVerifier(credential: string): Promise<string> {
  const bytes = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(credential),
  );
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function backendOrigin(): string {
  return import.meta.env.VITE_HALLIGALLI_BACKEND_URL ?? "";
}

function websocketOrigin(): string {
  const configured = backendOrigin();
  if (configured) {
    const url = new URL(configured);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    return url.origin;
  }
  return `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}`;
}

async function readEntry(
  path: string,
  payload: EntryRequest,
  idempotencyKey: string,
): Promise<EntryResult> {
  const response = await fetch(`${backendOrigin()}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const problem = (await response.json()) as ProblemDetails;
    throw new Error(problem.title || "Room entry failed");
  }
  return response.json() as Promise<EntryResult>;
}

function watchRoom(session: RoomSession, onSnapshot: (snapshot: RoomSnapshot) => void): () => void {
  const socket = new WebSocket(
    `${websocketOrigin()}/ws/v1/rooms/${encodeURIComponent(session.roomCode)}`,
  );
  socket.addEventListener("open", () => {
    socket.send(JSON.stringify({ type: "authenticate", credential: session.credential }));
  });
  socket.addEventListener("message", (event) => {
    const payload = JSON.parse(String(event.data)) as { type?: unknown; snapshot?: RoomSnapshot };
    if (payload.type === "snapshot" && payload.snapshot) {
      onSnapshot(payload.snapshot);
    }
  });
  return () => socket.close();
}

export function useRoomEntry() {
  const [session, setSession] = useState<RoomSession | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!session) return;
    return watchRoom(session, (snapshot) => {
      setSession((current) => current && {
        ...current,
        snapshot,
      });
    });
  }, [session?.credential, session?.roomCode]);

  async function enter(path: string, name: string): Promise<void> {
    setPending(true);
    setError("");
    try {
      const credential = createCredential();
      const result = await readEntry(
        path,
        {
          name: name.trim() || "Player",
          credentialVerifier: await credentialVerifier(credential),
        },
        globalThis.crypto.randomUUID(),
      );
      setSession({
        credential,
        roomCode: result.roomCode,
        snapshot: result.snapshot,
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Room entry failed");
    } finally {
      setPending(false);
    }
  }

  return {
    session,
    error,
    pending,
    createRoom: (name: string) => enter("/api/v1/rooms", name),
    joinRoom: (roomCode: string, name: string) =>
      enter(`/api/v1/rooms/${encodeURIComponent(roomCode.trim().toUpperCase())}/participants`, name),
  };
}
