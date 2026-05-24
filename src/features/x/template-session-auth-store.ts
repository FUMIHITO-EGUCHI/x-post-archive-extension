const SESSION_STORAGE_KEY = "x-post-archive:tweet-detail-template-auth";

export type TweetDetailTemplateSessionAuth = {
  authorization?: string;
  "x-client-transaction-id"?: string;
  "x-client-uuid"?: string;
};

type SessionStorageArea = {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(key: string): Promise<void>;
};

function getSessionStorage(): SessionStorageArea | null {
  const storage = (browser as { storage?: { session?: unknown } } | undefined)?.storage;
  const session = storage?.session;

  if (typeof session !== "object" || session === null) {
    return null;
  }

  const candidate = session as Partial<SessionStorageArea>;

  if (
    typeof candidate.get !== "function" ||
    typeof candidate.set !== "function" ||
    typeof candidate.remove !== "function"
  ) {
    return null;
  }

  return candidate as SessionStorageArea;
}

export async function setTweetDetailTemplateSessionAuth(
  auth: TweetDetailTemplateSessionAuth
): Promise<void> {
  const storage = getSessionStorage();

  if (storage === null) {
    return;
  }

  const payload: TweetDetailTemplateSessionAuth = {};

  if (typeof auth.authorization === "string" && auth.authorization !== "") {
    payload.authorization = auth.authorization;
  }

  if (
    typeof auth["x-client-transaction-id"] === "string" &&
    auth["x-client-transaction-id"] !== ""
  ) {
    payload["x-client-transaction-id"] = auth["x-client-transaction-id"];
  }

  if (typeof auth["x-client-uuid"] === "string" && auth["x-client-uuid"] !== "") {
    payload["x-client-uuid"] = auth["x-client-uuid"];
  }

  if (Object.keys(payload).length === 0) {
    return;
  }

  await storage.set({ [SESSION_STORAGE_KEY]: payload });
}

export async function getTweetDetailTemplateSessionAuth(): Promise<TweetDetailTemplateSessionAuth> {
  const storage = getSessionStorage();

  if (storage === null) {
    return {};
  }

  const data = await storage.get(SESSION_STORAGE_KEY);
  const raw = data[SESSION_STORAGE_KEY];

  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return {};
  }

  const result: TweetDetailTemplateSessionAuth = {};
  const candidate = raw as Record<string, unknown>;

  if (typeof candidate.authorization === "string" && candidate.authorization !== "") {
    result.authorization = candidate.authorization;
  }

  if (
    typeof candidate["x-client-transaction-id"] === "string" &&
    candidate["x-client-transaction-id"] !== ""
  ) {
    result["x-client-transaction-id"] = candidate["x-client-transaction-id"];
  }

  if (
    typeof candidate["x-client-uuid"] === "string" &&
    candidate["x-client-uuid"] !== ""
  ) {
    result["x-client-uuid"] = candidate["x-client-uuid"];
  }

  return result;
}

export async function clearTweetDetailTemplateSessionAuth(): Promise<void> {
  const storage = getSessionStorage();

  if (storage === null) {
    return;
  }

  await storage.remove(SESSION_STORAGE_KEY);
}
