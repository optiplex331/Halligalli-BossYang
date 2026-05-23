import type { Difficulty, Language } from "../src/game/types.js";
import type { GameEngine } from "./GameEngine.js";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 4;
const ROOM_TIMEOUT_MS = 10 * 60 * 1000;

export type RoomState = "lobby" | "playing" | "finished";

export interface PlayerProjection {
  id: number;
  name: string;
  ready: boolean;
  connected: boolean;
  seatIndex: number;
  isHost: boolean;
}

export interface RoomProjection {
  code: string;
  hostId: number;
  maxPlayers: number;
  difficulty: Difficulty;
  duration: number;
  language: Language;
  state: RoomState;
  players: PlayerProjection[];
}

export function generateCode(existingCodes: ReadonlySet<string>): string {
  let code = "";
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
  ready = false;
  connected = true;
  seatIndex = -1;

  constructor(
    public id: number,
    public name: string,
    public socketId: string,
  ) {}

  toJSON(): Omit<PlayerProjection, "isHost"> {
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
  players = new Map<number, Player>();
  state: RoomState = "lobby";
  engine: GameEngine | null = null;
  createdAt = Date.now();
  lastActivityAt = Date.now();
  private _nextPlayerId = 0;

  constructor(
    public code: string,
    public hostId: number,
    public maxPlayers: number,
    public difficulty: Difficulty,
    public duration: number,
    public language: Language,
  ) {}

  touch(): void {
    this.lastActivityAt = Date.now();
  }

  isStale(): boolean {
    return Date.now() - this.lastActivityAt > ROOM_TIMEOUT_MS;
  }

  addPlayer(name: string, socketId: string): Player | null {
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

  removePlayer(playerId: number): boolean {
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
      const nextHost = this.players.values().next().value;
      if (nextHost) {
        this.hostId = nextHost.id;
      }
    }
    this.touch();
    return true;
  }

  getPlayerBySocketId(socketId: string): Player | null {
    for (const player of this.players.values()) {
      if (player.socketId === socketId) return player;
    }
    return null;
  }

  allReady(): boolean {
    if (this.players.size < 2) return false;
    for (const player of this.players.values()) {
      if (!player.ready) return false;
    }
    return true;
  }

  playerList(): PlayerProjection[] {
    return Array.from(this.players.values()).map((p) => ({
      ...p.toJSON(),
      isHost: p.id === this.hostId,
    }));
  }

  toJSON(): RoomProjection {
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
