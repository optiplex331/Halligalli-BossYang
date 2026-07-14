import { useEffect, useRef, useState } from "react";

import type { components } from "./rest.generated.js";

type EntryRequest = components["schemas"]["EntryRequest"];
type CreateRoomRequest = components["schemas"]["CreateRoomRequest"];
type EntryResult = components["schemas"]["EntryResult"];
type ProblemDetails = components["schemas"]["ProblemDetails"];

export type RoomSnapshot = components["schemas"]["RoomSnapshot"];

interface RoomSession {
  credential: string;
  roomCode: string;
  snapshot: RoomSnapshot;
}

export type RoomSessionState = "no_room" | "entering" | "connecting" | "lobby" | "playing" | "post_match" | "leaving";

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
  payload: EntryRequest | CreateRoomRequest,
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

async function readSnapshot(session: RoomSession): Promise<RoomSnapshot> {
  const response = await fetch(`${backendOrigin()}/api/v1/rooms/${encodeURIComponent(session.roomCode)}`, {
    headers: { Authorization: `Bearer ${session.credential}` },
  });
  if (!response.ok) throw new Error("Room snapshot is unavailable");
  return response.json() as Promise<RoomSnapshot>;
}

function watchRoom(session: RoomSession, onSnapshot: (snapshot: RoomSnapshot) => void): WebSocket {
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
  return socket;
}

export function useRoomEntry() {
  const [session, setSession] = useState<RoomSession | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [connected, setConnected] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const socketRef = useRef<WebSocket | null>(null);
  const sessionRef = useRef<RoomSession | null>(null);
  const generationRef = useRef(0);
  const enteringRef = useRef(false);
  const intentionalCloseRef = useRef(new WeakSet<WebSocket>());
  const [state, setState] = useState<RoomSessionState>("no_room");

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    if (!session) {
      socketRef.current = null;
      setConnected(false);
      return;
    }
    const generation = generationRef.current;
    setState("connecting");
    let retryTimer: number | null = null;
    const socket = watchRoom(session, (snapshot) => {
      void (async () => {
        const current = generationRef.current === generation && socketRef.current === socket ? sessionRef.current : null;
        if (!current || snapshot.revision <= current.snapshot.revision) return;
        const replacement = snapshot.revision > current.snapshot.revision + 1
          ? await readSnapshot(current)
          : snapshot;
        setSession((previous) => generationRef.current === generation && previous && previous.roomCode === current.roomCode ? {
          ...previous,
          snapshot: replacement,
        } : previous);
        setState(replacement.phase);
      })().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Room snapshot is unavailable"));
    });
    socketRef.current = socket;
    socket.addEventListener("open", () => {
      if (generationRef.current !== generation) return;
      setConnected(true);
      setState(session.snapshot.phase);
    });
    socket.addEventListener("close", () => {
      if (generationRef.current !== generation) return;
      setConnected(false);
      if (!intentionalCloseRef.current.has(socket)) {
        retryTimer = window.setTimeout(() => {
          if (generationRef.current === generation) setRetryNonce((value) => value + 1);
        }, 400);
      }
    });
    return () => {
      if (socketRef.current === socket) {
        socketRef.current = null;
      }
      intentionalCloseRef.current.add(socket);
      socket.close();
      if (retryTimer !== null) window.clearTimeout(retryTimer);
    };
  }, [session?.credential, session?.roomCode, retryNonce]);

  useEffect(() => {
    if (!session || state === "leaving" || state === "connecting") return;
    setState(session.snapshot.phase);
  }, [session?.snapshot.phase, state]);

  function sendCommand(type: "ready" | "start" | "bell" | "leave" | "forfeit" | "continue" | "post_match_leave"): void {
    const socket = socketRef.current;
    if (socket?.readyState !== WebSocket.OPEN) {
      setError("Room connection is unavailable");
      return;
    }
    socket.send(JSON.stringify({ type, commandId: globalThis.crypto.randomUUID() }));
  }

  async function enter(path: string, payload: EntryRequest | CreateRoomRequest): Promise<void> {
    if (enteringRef.current || sessionRef.current) return;
    enteringRef.current = true;
    generationRef.current += 1;
    const generation = generationRef.current;
    setState("entering");
    setPending(true);
    setError("");
    try {
      const credential = createCredential();
      const result = await readEntry(
        path,
        { ...payload, name: payload.name.trim() || "Player", credentialVerifier: await credentialVerifier(credential) },
        globalThis.crypto.randomUUID(),
      );
      if (generationRef.current !== generation) return;
      const nextSession = {
        credential,
        roomCode: result.roomCode,
        snapshot: result.snapshot,
      };
      sessionRef.current = nextSession;
      setSession(nextSession);
    } catch (reason) {
      if (generationRef.current === generation) {
        setError(reason instanceof Error ? reason.message : "Room entry failed");
        setState("no_room");
      }
    } finally {
      if (generationRef.current === generation) setPending(false);
      enteringRef.current = false;
    }
  }

  function leaveRoom(): void {
    if (!sessionRef.current || state === "leaving") return;
    setState("leaving");
    sendCommand("leave");
    const socket = socketRef.current;
    if (socket) intentionalCloseRef.current.add(socket);
    generationRef.current += 1;
    sessionRef.current = null;
    setSession(null);
    setConnected(false);
    setState("no_room");
  }

  return {
    session,
    error,
    pending,
    connected,
    state,
    createRoom: (name: string, configuration: Omit<CreateRoomRequest, "name" | "credentialVerifier">) =>
      enter("/api/v1/rooms", { name, credentialVerifier: "", ...configuration }),
    joinRoom: (roomCode: string, name: string) =>
      enter(`/api/v1/rooms/${encodeURIComponent(roomCode.trim().toUpperCase())}/participants`, { name, credentialVerifier: "" }),
    ready: () => sendCommand("ready"),
    start: () => sendCommand("start"),
    ringBell: () => sendCommand("bell"),
    leaveRoom,
    forfeit: () => sendCommand("forfeit"),
    continueMatch: () => sendCommand("continue"),
    leaveAfterMatch: () => sendCommand("post_match_leave"),
  };
}
