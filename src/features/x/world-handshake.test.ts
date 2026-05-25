import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("world handshake", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends a handshake message exactly once per isolated world", async () => {
    const postMessage = vi.fn();
    vi.stubGlobal("window", {
      postMessage,
      location: { origin: "https://x.com" },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    });

    const handshake = await import("./world-handshake");
    handshake.sendIsolatedHandshakeOnce();
    handshake.sendIsolatedHandshakeOnce();

    expect(postMessage).toHaveBeenCalledTimes(1);
    const [payload, origin] = postMessage.mock.calls[0]!;
    expect(payload).toMatchObject({
      type: handshake.WORLD_HANDSHAKE_MESSAGE_TYPE
    });
    expect(typeof payload.token).toBe("string");
    expect(payload.token.length).toBeGreaterThanOrEqual(16);
    expect(origin).toBe("https://x.com");
  });

  it("rejects event tokens before the isolated handshake has been issued", async () => {
    vi.stubGlobal("window", {
      postMessage: vi.fn(),
      location: { origin: "https://x.com" },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    });
    const handshake = await import("./world-handshake");
    expect(handshake.verifyMainWorldEventToken("anything")).toBe(false);
  });

  it("accepts event tokens that match the issued isolated token", async () => {
    vi.stubGlobal("window", {
      postMessage: vi.fn(),
      location: { origin: "https://x.com" },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    });

    const handshake = await import("./world-handshake");
    const token = handshake.getOrCreateIsolatedHandshakeToken();
    handshake.sendIsolatedHandshakeOnce();

    expect(handshake.verifyMainWorldEventToken(token)).toBe(true);
    expect(handshake.verifyMainWorldEventToken("wrong-token")).toBe(false);
  });

  it("captures a main-world token only for same-origin, same-source messages", async () => {
    const listeners: Array<(event: MessageEvent) => void> = [];
    const fakeWindow = {
      postMessage: vi.fn(),
      location: { origin: "https://x.com" },
      addEventListener: vi.fn((eventName: string, handler: (event: MessageEvent) => void) => {
        if (eventName === "message") {
          listeners.push(handler);
        }
      }),
      removeEventListener: vi.fn()
    };
    vi.stubGlobal("window", fakeWindow);

    const handshake = await import("./world-handshake");
    handshake.installMainWorldHandshakeListener();
    expect(listeners.length).toBe(1);

    const validToken = "0123456789abcdef-token";
    const validEvent = {
      source: fakeWindow,
      origin: "https://x.com",
      data: {
        type: handshake.WORLD_HANDSHAKE_MESSAGE_TYPE,
        token: validToken
      }
    } as unknown as MessageEvent;

    listeners[0]!(validEvent);
    expect(handshake.getMainWorldHandshakeToken()).toBe(validToken);

    const crossOriginEvent = {
      source: fakeWindow,
      origin: "https://attacker.example.com",
      data: {
        type: handshake.WORLD_HANDSHAKE_MESSAGE_TYPE,
        token: "spoofed-token-1234"
      }
    } as unknown as MessageEvent;
    listeners[0]?.(crossOriginEvent);
    expect(handshake.getMainWorldHandshakeToken()).toBe(validToken);
  });
});
