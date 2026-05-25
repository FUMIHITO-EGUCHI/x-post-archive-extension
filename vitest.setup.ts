// Vitest setup. WXT auto-generates a global `browser` polyfill at runtime;
// in unit tests we declare a minimal shape so source files compile and run.
import { vi } from "vitest";

declare global {
  var browser: unknown;
  var chrome: unknown;
}

if (typeof globalThis.browser === "undefined") {
  globalThis.browser = {};
}

if (typeof globalThis.chrome === "undefined") {
  globalThis.chrome = {
    runtime: {
      getURL: (path: string) => `chrome-extension://test-id${path}`
    }
  };
}

// Suppress noisy crypto fallback warning under happy-dom.
if (typeof globalThis.crypto?.randomUUID !== "function") {
  Object.defineProperty(globalThis.crypto, "randomUUID", {
    configurable: true,
    value: () => {
      const bytes = new Uint8Array(16);
      // happy-dom provides getRandomValues; fall back to Math.random in pathological cases.
      if (typeof globalThis.crypto.getRandomValues === "function") {
        globalThis.crypto.getRandomValues(bytes);
      } else {
        for (let index = 0; index < bytes.length; index += 1) {
          bytes[index] = Math.floor(Math.random() * 256);
        }
      }
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }
  });
}

// Re-export vi so tests that import "../vitest.setup" don't trip TypeScript dead-import errors.
export { vi };
