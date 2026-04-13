import { createServer } from "http";
import { readFile, stat } from "fs/promises";
import { join, extname } from "path";
import { fileURLToPath } from "url";
import { Server } from "socket.io";
import { Room, generateCode } from "./Room.js";
import { GameEngine } from "./GameEngine.js";

const PORT = process.env.PORT || 3001;
const __dirname = fileURLToPath(new URL(".", import.meta.url));
const DIST_DIR = join(__dirname, "..", "dist");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".webp": "image/webp",
};

async function serveStatic(req, res) {
  // Health check
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", rooms: rooms.size }));
    return;
  }

  // Parse URL without query string
  const urlPath = req.url.split("?")[0];
  const filePath = join(DIST_DIR, urlPath === "/" ? "index.html" : urlPath);

  // Prevent directory traversal
  if (!filePath.startsWith(DIST_DIR)) {
    res.writeHead(403);
    res.end();
    return;
  }

  try {
    const info = await stat(filePath);
    if (info.isFile()) {
      const ext = extname(filePath);
      const mime = MIME_TYPES[ext] || "application/octet-stream";
      const body = await readFile(filePath);
      // Cache hashed assets aggressively, others briefly
      const cacheControl = urlPath.includes("/assets/")
        ? "public, max-age=31536000, immutable"
        : "public, max-age=300";
      res.writeHead(200, { "Content-Type": mime, "Cache-Control": cacheControl });
      res.end(body);
      return;
    }
  } catch {
    // File not found — fall through to SPA fallback
  }

  // SPA fallback: serve index.html for non-file routes
  try {
    const indexHtml = await readFile(join(DIST_DIR, "index.html"));
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(indexHtml);
  } catch {
    res.writeHead(404);
    res.end("Not found — run `npm run build` first");
  }
}

const httpServer = createServer(serveStatic);

const io = new Server(httpServer);

const rooms = new Map();

// Cleanup stale rooms every 2 minutes
setInterval(() => {
  for (const [code, room] of rooms) {
    if (room.isStale()) {
      if (room.engine) room.engine.destroy();
      io.to(code).emit("room:dissolved", { reason: "timeout" });
      rooms.delete(code);
      console.log(`Room ${code} dissolved (stale)`);
    }
  }
}, 120_000);

function findRoomBySocket(socketId) {
  for (const room of rooms.values()) {
    const player = room.getPlayerBySocketId(socketId);
    if (player) return { room, player };
  }
  return { room: null, player: null };
}

io.on("connection", (socket) => {
  console.log(`Connected: ${socket.id}`);

  socket.on("room:create", ({ playerName, maxPlayers, difficulty, duration, language }) => {
    const code = generateCode(new Set(rooms.keys()));
    const room = new Room(code, 0, maxPlayers || 4, difficulty || "normal", duration || 60, language || "zh");
    const player = room.addPlayer(playerName || "Player 1", socket.id);

    rooms.set(code, room);
    socket.join(code);

    socket.emit("room:created", {
      code,
      playerId: player.id,
      room: room.toJSON(),
    });
    console.log(`Room ${code} created by ${playerName}`);
  });

  socket.on("room:join", ({ code, playerName }) => {
    const normalizedCode = (code || "").toUpperCase().trim();
    const room = rooms.get(normalizedCode);

    if (!room) {
      socket.emit("room:error", {
        message: "Room not found",
        messageZh: "房间不存在",
      });
      return;
    }

    if (room.state !== "lobby") {
      socket.emit("room:error", {
        message: "Game already in progress",
        messageZh: "游戏已经开始",
      });
      return;
    }

    const player = room.addPlayer(playerName || `Player ${room.players.size + 1}`, socket.id);
    if (!player) {
      socket.emit("room:error", {
        message: "Room is full",
        messageZh: "房间已满",
      });
      return;
    }

    socket.join(normalizedCode);
    socket.emit("room:joined", {
      playerId: player.id,
      room: room.toJSON(),
    });
    socket.to(normalizedCode).emit("room:player-update", {
      players: room.playerList(),
    });
    console.log(`${playerName} joined room ${normalizedCode}`);
  });

  socket.on("room:ready", ({ ready }) => {
    const { room, player } = findRoomBySocket(socket.id);
    if (!room || !player) return;

    player.ready = Boolean(ready);
    room.touch();
    io.to(room.code).emit("room:player-update", {
      players: room.playerList(),
    });
  });

  socket.on("room:start", () => {
    const { room, player } = findRoomBySocket(socket.id);
    if (!room || !player) return;

    if (player.id !== room.hostId) {
      socket.emit("room:error", {
        message: "Only the host can start the game",
        messageZh: "只有房主可以开始游戏",
      });
      return;
    }

    if (!room.allReady()) {
      socket.emit("room:error", {
        message: "Not all players are ready",
        messageZh: "还有玩家未准备",
      });
      return;
    }

    room.state = "playing";
    room.touch();

    const engine = new GameEngine(
      room.players.size,
      room.difficulty,
      room.duration,
      (event, data) => {
        io.to(room.code).emit(event, data);
      },
    );

    room.engine = engine;
    const startPayload = engine.start();

    // Map seat indices to player info
    const seatMap = [];
    for (const p of room.players.values()) {
      seatMap[p.seatIndex] = { id: p.id, name: p.name };
    }

    io.to(room.code).emit("game:start", {
      ...startPayload,
      seatMap,
    });

    // Send each player their seat index
    for (const p of room.players.values()) {
      const s = io.sockets.sockets.get(p.socketId);
      if (s) {
        s.emit("game:your-seat", { seatIndex: p.seatIndex });
      }
    }

    console.log(`Game started in room ${room.code}`);
  });

  socket.on("game:bell", () => {
    const { room, player } = findRoomBySocket(socket.id);
    if (!room || !player || !room.engine) return;
    room.touch();
    room.engine.handleBellPress(player.seatIndex);
  });

  socket.on("room:leave", () => {
    handleDisconnect(socket);
  });

  socket.on("disconnect", () => {
    handleDisconnect(socket);
    console.log(`Disconnected: ${socket.id}`);
  });
});

function handleDisconnect(socket) {
  const { room, player } = findRoomBySocket(socket.id);
  if (!room || !player) return;

  socket.leave(room.code);

  if (room.state === "lobby") {
    room.removePlayer(player.id);
    if (room.players.size === 0) {
      rooms.delete(room.code);
      console.log(`Room ${room.code} dissolved (empty)`);
    } else {
      io.to(room.code).emit("room:player-update", {
        players: room.playerList(),
      });
    }
  } else if (room.state === "playing") {
    player.connected = false;
    io.to(room.code).emit("room:player-update", {
      players: room.playerList(),
    });
    // If all disconnected, end the game
    const allDisconnected = Array.from(room.players.values()).every((p) => !p.connected);
    if (allDisconnected) {
      if (room.engine) room.engine.destroy();
      rooms.delete(room.code);
      console.log(`Room ${room.code} dissolved (all disconnected)`);
    }
  }
}

httpServer.listen(PORT, () => {
  console.log(`Halligalli server listening on port ${PORT}`);
});
