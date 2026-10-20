export type FruitKey = "banana" | "strawberry" | "lemon" | "grape";
export type Difficulty = "easy" | "normal" | "hard";

export const FRUITS: readonly { key: FruitKey; icon: string }[] = [
  { key: "banana", icon: "🍌" },
  { key: "strawberry", icon: "🍓" },
  { key: "lemon", icon: "🍋" },
  { key: "grape", icon: "🍇" },
];

export const DIFFICULTIES: readonly { key: Difficulty; label: string }[] = [
  { key: "easy", label: "Easy" },
  { key: "normal", label: "Normal" },
  { key: "hard", label: "Hard" },
];
