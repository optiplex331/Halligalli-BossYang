import { afterEach, describe, expect, it } from "vitest";
import { createHalligalliServer } from "../index.js";
import { createHealthPayload } from "../health.js";

const ORIGINAL_ENV = {
  APP_VERSION: process.env.APP_VERSION,
  COMMIT_SHA: process.env.COMMIT_SHA,
  GITHUB_SHA: process.env.GITHUB_SHA,
};

afterEach(() => {
  for (const key of Object.keys(ORIGINAL_ENV)) {
    if (ORIGINAL_ENV[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = ORIGINAL_ENV[key];
    }
  }
});

function clearReleaseEnv() {
  delete process.env.APP_VERSION;
  delete process.env.COMMIT_SHA;
  delete process.env.GITHUB_SHA;
}

function listen(server) {
  return new Promise((resolve) => {
    server.httpServer.listen(0, "127.0.0.1", () => {
      const { port } = server.httpServer.address();
      resolve(`http://127.0.0.1:${port}`);
    });
  });
}

function stop(server) {
  return new Promise((resolve) => {
    server.stop(resolve);
  });
}

describe("health payload", () => {
  it("returns stable local release fallbacks", () => {
    expect(createHealthPayload({ roomCount: 2, env: {} })).toEqual({
      status: "ok",
      rooms: 2,
      version: "local",
      commit: "unknown",
    });
  });

  it("uses injected release metadata", () => {
    expect(
      createHealthPayload({
        roomCount: 1,
        env: {
          APP_VERSION: "0.1.0-0004-gabc1234",
          COMMIT_SHA: "abc1234def5678",
        },
      }),
    ).toEqual({
      status: "ok",
      rooms: 1,
      version: "0.1.0-0004-gabc1234",
      commit: "abc1234def5678",
    });
  });
});

describe("/health", () => {
  it("reports status, active room count, app version, and commit SHA", async () => {
    process.env.APP_VERSION = "0.1.0-0007-g7654321";
    process.env.COMMIT_SHA = "7654321fedcba";

    const server = createHalligalliServer();
    server.rooms.set("ROOM", {});

    try {
      const baseUrl = await listen(server);
      const response = await fetch(`${baseUrl}/health`);

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("application/json");
      expect(await response.json()).toEqual({
        status: "ok",
        rooms: 1,
        version: "0.1.0-0007-g7654321",
        commit: "7654321fedcba",
      });
    } finally {
      await stop(server);
    }
  });

  it("keeps working locally without release metadata", async () => {
    clearReleaseEnv();

    const server = createHalligalliServer();

    try {
      const baseUrl = await listen(server);
      const response = await fetch(`${baseUrl}/health`);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        status: "ok",
        rooms: 0,
        version: "local",
        commit: "unknown",
      });
    } finally {
      await stop(server);
    }
  });
});
