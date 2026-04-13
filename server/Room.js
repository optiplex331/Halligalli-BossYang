const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 4;
const ROOM_TIMEOUT_MS = 10 * 60 * 1000;

export function generateCode(existingCodes) {
  let code;
  let attempts = 0;
  do {
    code = "";
    for (let i = 0; i < CODE_LENGTH; i++) {
      code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    }
    attempts++;
  } while (existingCodes.has(code) && attempts < 100);
  return code;
}

export class Player {
  constructor(id, name, socketId) {
    this.id = id;
    this.name = name;
    this.socketId = socketId;
    this.ready = false;
    this.connected = true;
    this.seatIndex = -1;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      ready: this.ready,
      connected: this.connected,
      seatIndex: this.seatIndex,
    };
  }
}

export class Room {
  constructor(code, hostId, maxPlayers, difficulty, duration, language) {
    this.code = code;
    this.hostId = hostId;
    this.maxPlayers = maxPlayers;
    this.difficulty = difficulty;
    this.duration = duration;
    this.language = language;
    this.players = new Map();
    this.state = "lobby"; // lobby | playing | finished
    this.engine = null;
    this.createdAt = Date.now();
    this.lastActivityAt = Date.now();
    this._nextPlayerId = 0;
  }

  touch() {
    this.lastActivityAt = Date.now();
  }

  isStale() {
    return Date.now() - this.lastActivityAt > ROOM_TIMEOUT_MS;
  }

  addPlayer(name, socketId) {
    if (this.players.size >= this.maxPlayers) {
      return null;
    }
    if (this.state !== "lobby") {
      return null;
    }
    const id = this._nextPlayerId++;
    const player = new Player(id, name, socketId);
    player.seatIndex = this.players.size;
    this.players.set(id, player);
    this.touch();
    return player;
  }

  removePlayer(playerId) {
    const player = this.players.get(playerId);
    if (!player) return false;
    this.players.delete(playerId);
    // Reassign seat indices
    let seat = 0;
    for (const p of this.players.values()) {
      p.seatIndex = seat++;
    }
    // Transfer host if needed
    if (this.hostId === playerId && this.players.size > 0) {
      this.hostId = this.players.values().next().value.id;
    }
    this.touch();
    return true;
  }

  getPlayerBySocketId(socketId) {
    for (const player of this.players.values()) {
      if (player.socketId === socketId) return player;
    }
    return null;
  }

  allReady() {
    if (this.players.size < 2) return false;
    for (const player of this.players.values()) {
      if (!player.ready) return false;
    }
    return true;
  }

  playerList() {
    return Array.from(this.players.values()).map((p) => ({
      ...p.toJSON(),
      isHost: p.id === this.hostId,
    }));
  }

  toJSON() {
    return {
      code: this.code,
      hostId: this.hostId,
      maxPlayers: this.maxPlayers,
      difficulty: this.difficulty,
      duration: this.duration,
      language: this.language,
      state: this.state,
      players: this.playerList(),
    };
  }
}
