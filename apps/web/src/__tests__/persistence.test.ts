import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  loadSettings,
  normalizeSettings,
  saveSettings,
} from "../game/persistence.js";

describe("Local Preferences", () => {
  const originalWindow = globalThis.window;
  let store: Map<string, string>;

  beforeEach(() => {
    store = new Map();
    globalThis.window = {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => store.set(key, String(value)),
        removeItem: (key: string) => store.delete(key),
      },
    } as unknown as Window & typeof globalThis;
  });

  afterEach(() => {
    globalThis.window = originalWindow;
  });

  it("normalizes Local Preferences at their persistence boundary", () => {
    expect(normalizeSettings({ tableSeatCount: 8, language: "zh", soundEnabled: false })).toEqual({
      difficulty: "normal",
      duration: 60,
      tableSeatCount: 8,
      language: "zh",
      soundEnabled: false,
    });
  });

  it("persists only normalized settings", () => {
    saveSettings({ difficulty: "hard", duration: 90, tableSeatCount: 6, language: "en", soundEnabled: true });

    expect(loadSettings()).toEqual({
      difficulty: "hard",
      duration: 90,
      tableSeatCount: 6,
      language: "en",
      soundEnabled: true,
    });
  });

});
