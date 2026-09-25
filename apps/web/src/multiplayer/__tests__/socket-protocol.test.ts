import { describe, expect, it } from "vitest";

import { parseServerFrame, reconnectDelayMs } from "../socket-protocol.js";

describe("room socket frames", () => {
  it("ignores malformed or unknown frames instead of throwing", () => {
    for (const data of ["", "{", "null", "42", "[]", '{"type":"snapshot"}', '{"type":"mystery"}', '{"type":"error","code":7}']) {
      expect(parseServerFrame(data)).toBeNull();
    }
  });

  it("reads snapshot and error frames", () => {
    expect(parseServerFrame('{"type":"snapshot","snapshot":{"revision":3}}')).toEqual({
      type: "snapshot",
      snapshot: { revision: 3 },
    });
    expect(parseServerFrame('{"type":"error","code":"host_required","title":"Only the host can start the match"}')).toEqual({
      type: "error",
      code: "host_required",
      title: "Only the host can start the match",
    });
  });
});

describe("room reconnect backoff", () => {
  it("grows with repeated failures and stays capped at a few seconds", () => {
    const slowest = (attempt: number) => reconnectDelayMs(attempt, () => 1);
    const fastest = (attempt: number) => reconnectDelayMs(attempt, () => 0);

    expect(slowest(0)).toBeLessThan(slowest(1));
    expect(slowest(1)).toBeLessThan(slowest(2));
    expect(fastest(3)).toBeGreaterThan(slowest(0));
    expect(slowest(50)).toBeLessThanOrEqual(5_000);
    expect(fastest(50)).toBeGreaterThanOrEqual(2_500);
  });

  it("spreads reconnect attempts with jitter", () => {
    expect(reconnectDelayMs(4, () => 0)).not.toEqual(reconnectDelayMs(4, () => 1));
  });
});
