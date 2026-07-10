import type { Difficulty, FruitDefinition } from "./types.js";

export const FRUITS = [
  { key: "banana", label: "香蕉", labelEn: "banana", icon: "🍌" },
  { key: "strawberry", label: "草莓", labelEn: "strawberry", icon: "🍓" },
  { key: "lemon", label: "柠檬", labelEn: "lemon", icon: "🍋" },
  { key: "grape", label: "葡萄", labelEn: "grape", icon: "🍇" },
] as const satisfies readonly FruitDefinition[];

export interface GameModeConfig {
  label: string;
  labelEn: string;
  revealMs: number;
  scoreBonusWindow: number;
  isBoss?: boolean;
}

export const MODES = {
  easy: {
    label: "简单",
    labelEn: "Easy",
    revealMs: 1850,
    scoreBonusWindow: 1900,
  },
  normal: {
    label: "标准",
    labelEn: "Normal",
    revealMs: 1400,
    scoreBonusWindow: 1500,
  },
  hard: {
    label: "Boss模式",
    labelEn: "Boss Mode",
    revealMs: 900,
    scoreBonusWindow: 1000,
    isBoss: true,
  },
} as const satisfies Record<Difficulty, GameModeConfig>;
