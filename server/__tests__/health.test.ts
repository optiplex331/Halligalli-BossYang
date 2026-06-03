import { afterEach, describe, expect, it } from "vitest";
import type { AddressInfo } from "net";
import { createHalligalliServer } from "../index.js";
import { createHealthPayload } from "../health.js";
import { Room } from "../Room.js";

const ORIGINAL_ENV = {
  APP_VERSION: process.env.APP_VERSION,
  COMMIT_SHA: process.env.COMMIT_SHA,
  GITHUB_SHA: process.env.GITHUB_SHA,
  HALLIGALLI_ALLOWED_ORIGINS: process.env.HALLIGALLI_ALLOWED_ORIGINS,
};

afterEach(() => {
  for (const key of Object.keys(ORIGINAL_ENV) as Array<keyof typeof ORIGINAL_ENV>) {
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

type HalligalliServer = ReturnType<typeof createHalligalliServer>;

function listen(server: HalligalliServer): Promise<string> {
  return new Promise((resolve) => {
    server.httpServer.listen(0, "127.0.0.1", () => {
      const address = server.httpServer.address();
      if (!address || typeof address === "string") {
        throw new Error("Expected test server to listen on a TCP port");
      }
      const { port } = address as AddressInfo;
      resolve(`http://127.0.0.1:${port}`);
    });
  });
}

function stop(server: HalligalliServer): Promise<void> {
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
    server.rooms.set("ROOM", new Room("ROOM", 0, 4, "normal", 60, "zh"));

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

describe("/readyz", () => {
  it("reports server readiness without release identity", async () => {
    const server = createHalligalliServer();
    server.rooms.set("ROOM", new Room("ROOM", 0, 4, "normal", 60, "zh"));

    try {
      const baseUrl = await listen(server);
      const response = await fetch(`${baseUrl}/readyz`);

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("application/json");
      expect(await response.json()).toEqual({
        status: "ready",
      });
    } finally {
      await stop(server);
    }
  });
});

describe("socket CORS", () => {
  it("keeps local same-origin behavior without wildcard CORS when no allow-list is configured", async () => {
    delete process.env.HALLIGALLI_ALLOWED_ORIGINS;
    const server = createHalligalliServer();

    try {
      const baseUrl = await listen(server);
      const response = await fetch(`${baseUrl}/socket.io/?EIO=4&transport=polling`, {
        headers: {
          Origin: "https://preview.example.com",
        },
      });

      expect(response.status).toBe(200);
      expect(response.headers.get("access-control-allow-origin")).toBeNull();
    } finally {
      await stop(server);
    }
  });

  it("allows configured frontend origins from a comma-separated allow-list", async () => {
    process.env.HALLIGALLI_ALLOWED_ORIGINS =
      "https://staging.example.com, https://preview.example.com";
    const server = createHalligalliServer();

    try {
      const baseUrl = await listen(server);
      const response = await fetch(`${baseUrl}/socket.io/?EIO=4&transport=polling`, {
        headers: {
          Origin: "https://preview.example.com",
        },
      });

      expect(response.status).toBe(200);
      expect(response.headers.get("access-control-allow-origin")).toBe(
        "https://preview.example.com",
      );
    } finally {
      await stop(server);
    }
  });

  it("rejects unlisted frontend origins when the allow-list is configured", async () => {
    process.env.HALLIGALLI_ALLOWED_ORIGINS = "https://staging.example.com";
    const server = createHalligalliServer();

    try {
      const baseUrl = await listen(server);
      const response = await fetch(`${baseUrl}/socket.io/?EIO=4&transport=polling`, {
        headers: {
          Origin: "https://evil.example",
        },
      });

      expect(response.status).toBe(403);
      expect(response.headers.get("access-control-allow-origin")).toBeNull();
    } finally {
      await stop(server);
    }
  });
});
