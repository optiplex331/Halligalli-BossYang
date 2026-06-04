import { afterEach, describe, expect, it, vi } from "vitest";

const ioMock = vi.hoisted(() => vi.fn(() => ({ connected: false, connect: vi.fn() })));

vi.mock("socket.io-client", () => ({
  io: ioMock,
}));

afterEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
  ioMock.mockClear();
});

describe("multiplayer socket Backend Entry", () => {
  it("uses same-origin socket.io when no Backend Entry is configured", async () => {
    const { getSocket } = await import("./socket.js");

    getSocket();

    expect(ioMock).toHaveBeenCalledWith({
      autoConnect: false,
      transports: ["websocket", "polling"],
    });
  });

  it("uses same-origin socket.io when Backend Entry is blank", async () => {
    vi.stubEnv("VITE_HALLIGALLI_BACKEND_URL", "   ");
    const { getSocket } = await import("./socket.js");

    getSocket();

    expect(ioMock).toHaveBeenCalledWith({
      autoConnect: false,
      transports: ["websocket", "polling"],
    });
  });

  it("uses an explicit Backend Entry URL for separated AWS scaffold", async () => {
    vi.stubEnv("VITE_HALLIGALLI_BACKEND_URL", " https://api.example.com ");
    const { getSocket } = await import("./socket.js");

    getSocket();

    expect(ioMock).toHaveBeenCalledWith("https://api.example.com", {
      autoConnect: false,
      transports: ["websocket", "polling"],
    });
  });
});
