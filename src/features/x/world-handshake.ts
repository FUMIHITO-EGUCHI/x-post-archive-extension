export const WORLD_HANDSHAKE_MESSAGE_TYPE = "x-post-archive:world-handshake";

const MIN_HANDSHAKE_TOKEN_LENGTH = 16;

let isolatedToken: string | null = null;
let isolatedHandshakeSent = false;
let mainWorldToken: string | null = null;
let mainWorldListenerInstalled = false;
let mainWorldListenerRef: ((event: MessageEvent) => void) | null = null;

export function getOrCreateIsolatedHandshakeToken(): string {
  if (isolatedToken === null) {
    isolatedToken = crypto.randomUUID();
  }

  return isolatedToken;
}

export function sendIsolatedHandshakeOnce(): void {
  if (isolatedHandshakeSent) {
    return;
  }

  isolatedHandshakeSent = true;

  if (typeof window === "undefined") {
    return;
  }

  try {
    window.postMessage(
      {
        type: WORLD_HANDSHAKE_MESSAGE_TYPE,
        token: getOrCreateIsolatedHandshakeToken()
      },
      window.location.origin
    );
  } catch {
    // Same-origin postMessage should not fail; ignore unexpected errors.
  }
}

export function verifyMainWorldEventToken(eventToken: unknown): boolean {
  if (typeof eventToken !== "string" || isolatedToken === null) {
    return false;
  }

  return timingSafeStringEqual(eventToken, isolatedToken);
}

export function installMainWorldHandshakeListener(): void {
  if (mainWorldListenerInstalled || typeof window === "undefined") {
    return;
  }

  mainWorldListenerInstalled = true;

  mainWorldListenerRef = (event: MessageEvent) => {
    if (event.source !== window) {
      return;
    }

    if (typeof event.origin !== "string" || event.origin !== window.location.origin) {
      return;
    }

    const data: unknown = event.data;

    if (typeof data !== "object" || data === null) {
      return;
    }

    const messageType = Reflect.get(data, "type");
    const token = Reflect.get(data, "token");

    if (
      messageType !== WORLD_HANDSHAKE_MESSAGE_TYPE ||
      typeof token !== "string" ||
      token.length < MIN_HANDSHAKE_TOKEN_LENGTH
    ) {
      return;
    }

    mainWorldToken = token;

    if (mainWorldListenerRef !== null) {
      window.removeEventListener("message", mainWorldListenerRef);
      mainWorldListenerRef = null;
    }
  };

  window.addEventListener("message", mainWorldListenerRef);
}

export function getMainWorldHandshakeToken(): string | null {
  return mainWorldToken;
}

function timingSafeStringEqual(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }

  let mismatch = 0;

  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return mismatch === 0;
}
