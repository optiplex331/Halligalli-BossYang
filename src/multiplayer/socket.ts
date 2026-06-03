import { io } from "socket.io-client";
import type { Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "./protocol.js";

type HalligalliSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: HalligalliSocket | null = null;

export function getSocket(): HalligalliSocket {
  if (!socket) {
    const backendUrl = import.meta.env.VITE_HALLIGALLI_BACKEND_URL?.trim();
    const options = {
      autoConnect: false,
      transports: ["websocket", "polling"],
    };
    socket = backendUrl ? io(backendUrl, options) : io(options);
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
