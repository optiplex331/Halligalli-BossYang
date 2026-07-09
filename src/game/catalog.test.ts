import { describe, expect, it } from "vitest";
import { FRUITS, MODES } from "./catalog.js";
import { createPlayers } from "./rules.js";

describe("shared game catalog", () => {
  it("supplies the fruit definitions used to create a supported table", () => {
    const players = createPlayers(3, FRUITS);

    expect(FRUITS.map((fruit) => fruit.key)).toEqual([
      "banana",
      "strawberry",
      "lemon",
      "grape",
    ]);
    expect(players).toHaveLength(3);
  });

  it("keeps every selectable difficulty's timing and bilingual label together", () => {
    expect(MODES.easy).toMatchObject({
      revealMs: 1850,
      scoreBonusWindow: 1900,
      label: "简单",
      labelEn: "Easy",
    });
    expect(MODES.hard).toMatchObject({ isBoss: true, labelEn: "Boss Mode" });
  });
});
