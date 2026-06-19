import { afterEach, describe, expect, it } from "vitest";
import type { AddressInfo } from "net";
import { io as createClient } from "socket.io-client";
import type { Socket } from "socket.io-client";
import { createHalligalliServer } from "../index.js";
import type {
  ClientToServerEvents,
  RoomCreatedPayload,
  RoomErrorPayload,
  RoomJoinedPayload,
  ServerToClientEvents,
} from "../../src/multiplayer/protocol.js";

type HalligalliServer = ReturnType<typeof createHalligalliServer>;
type TestSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const servers: HalligalliServer[] = [];
const sockets: TestSocket[] = [];

afterEach(async () => {
  for (const socket of sockets.splice(0)) {
    socket.removeAllListeners();
    socket.disconnect();
  }

  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.stop(resolve);
        }),
    ),
  );
});

function listen(server: HalligalliServer): Promise<string> {
  servers.push(server);

  return new Promise((resolve) => {
    server.httpServer.listen(0, "127.0.0.1", () => {
      const address = server.httpServer.address();
      if (!address || typeof address === "string") {
        throw new Error("Expected test server to listen on a TCP port");
      }

      resolve(`http://127.0.0.1:${(address as AddressInfo).port}`);
    });
  });
}

function connect(baseUrl: string): Promise<TestSocket> {
  const socket: TestSocket = createClient(baseUrl, {
    forceNew: true,
    transports: ["websocket"],
  });
  sockets.push(socket);

  return new Promise((resolve, reject) => {
    socket.once("connect", () => resolve(socket));
    socket.once("connect_error", reject);
  });
}

function waitForRoomError(socket: TestSocket): Promise<RoomErrorPayload> {
  return new Promise((resolve) => {
    socket.once("room:error", resolve);
  });
}

function waitForRoomCreated(socket: TestSocket): Promise<RoomCreatedPayload> {
  return new Promise((resolve) => {
    socket.once("room:created", resolve);
  });
}

function waitForRoomJoined(socket: TestSocket): Promise<RoomJoinedPayload> {
  return new Promise((resolve) => {
    socket.once("room:joined", resolve);
  });
}

describe("multiplayer room size validation", () => {
  it("rejects creating a 2-player room with room:error", async () => {
    const server = createHalligalliServer();
    const baseUrl = await listen(server);
    const host = await connect(baseUrl);
    const errorPromise = waitForRoomError(host);

    host.emit("room:create", {
      playerName: "Host",
      maxPlayers: 2,
      difficulty: "normal",
      duration: 60,
      language: "en",
    });

    await expect(errorPromise).resolves.toEqual({
      message: "This game supports 3 to 6 players",
      messageZh: "当前仅支持 3 到 6 人游戏",
    });
    expect(server.rooms.size).toBe(0);
  });

  it("rejects starting a room before the current player count is supported", async () => {
    const server = createHalligalliServer();
    const baseUrl = await listen(server);
    const host = await connect(baseUrl);
    const guest = await connect(baseUrl);
    const createdPromise = waitForRoomCreated(host);

    host.emit("room:create", {
      playerName: "Host",
      maxPlayers: 4,
      difficulty: "normal",
      duration: 60,
      language: "en",
    });
    const created = await createdPromise;

    const joinedPromise = waitForRoomJoined(guest);
    guest.emit("room:join", { code: created.code, playerName: "Guest" });
    await joinedPromise;

    host.emit("room:ready", { ready: true });
    guest.emit("room:ready", { ready: true });

    const errorPromise = waitForRoomError(host);
    host.emit("room:start");

    await expect(errorPromise).resolves.toEqual({
      message: "This game supports 3 to 6 players",
      messageZh: "当前仅支持 3 到 6 人游戏",
    });

    expect(server.rooms.get(created.code)?.state).toBe("lobby");
    expect(server.rooms.get(created.code)?.engine).toBeNull();
  });
});
