import { io } from "socket.io-client";
import type { Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "./protocol.js";

type HalligalliSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: HalligalliSocket | null = null;

export function getSocket(): HalligalliSocket {
  if (!socket) {
    socket = io({
      autoConnect: false,
      transports: ["websocket", "polling"],
    });
  }
  return socket;
}

export function connectSocket(): Socket {
  const s = getSocket();
  if (!s.connected) {
    s.connect();
  }
  return s;
}

export function disconnectSocket(): void {
  if (socket && socket.connected) {
    socket.disconnect();
  }
}
