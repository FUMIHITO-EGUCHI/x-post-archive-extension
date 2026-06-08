import { addLogRecord, pruneLogRecords } from "../../db/repositories/logs-repository";
import type { LogContext, LogLevel, LogRecord } from "../../types/logger";

const MAX_LOG_RECORDS = 2000;
const PRUNE_INTERVAL = 25;
// Why: high-frequency debug events (e.g. refetch.status polling every 2s) used to write an IDB
// record each time. Combined with prune deletes, the write+delete churn bloats the backing
// LevelDB with tombstones (#112). Suppress repeated debug persists per event within this window;
// the console mirror stays untouched so live debugging loses nothing.
const DEBUG_PERSIST_SUPPRESSION_WINDOW_MS = 30_000;
const DEBUG_PERSIST_KEY_LIMIT = 200;

let writesSinceLastPrune = 0;
let prunePromise: Promise<void> | null = null;
const lastDebugPersistAtByKey = new Map<string, number>();

export function createLogger(scope: string) {
  return {
    debug(event: string, options?: LogOptions): void {
      writeLog("debug", scope, event, options);
    },
    info(event: string, options?: LogOptions): void {
      writeLog("info", scope, event, options);
    },
    warn(event: string, options?: LogOptions): void {
      writeLog("warn", scope, event, options);
    },
    error(event: string, options?: LogOptions): void {
      writeLog("error", scope, event, options);
    }
  };
}

export function createRequestId(): string {
  return crypto.randomUUID();
}

type LogOptions = {
  context?: Record<string, unknown>;
  message?: string;
  requestId?: string | null;
};

function writeLog(level: LogLevel, scope: string, event: string, options?: LogOptions): void {
  const record: LogRecord = {
    log_id: crypto.randomUUID(),
    level,
    scope,
    event,
    message: normalizeMessage(options?.message),
    context: normalizeContext(options?.context),
    request_id: normalizeRequestId(options?.requestId),
    created_at: Date.now()
  };

  mirrorToConsole(record);

  if (level === "debug" && !checkAndMarkDebugPersist(record)) {
    return;
  }

  void addLogRecord(record)
    .then(() => {
      writesSinceLastPrune += 1;

      if (writesSinceLastPrune >= PRUNE_INTERVAL) {
        writesSinceLastPrune = 0;
        return schedulePrune();
      }

      return undefined;
    })
    .catch((error: unknown) => {
      console.error("App logger failed to persist a record.", {
        level,
        scope,
        event,
        error
      });
    });
}

// Returns true when the record should be persisted, recording it as the latest persist for its key.
function checkAndMarkDebugPersist(record: LogRecord): boolean {
  // Include context.type (the runtime message discriminator) so distinct message kinds sharing an
  // event name (e.g. runtime.message.received) do not suppress each other. A "|" separator keeps
  // segment boundaries unambiguous even if a segment ever contains spaces.
  const contextType = record.context["type"];
  const key = `${record.scope}|${record.event}|${typeof contextType === "string" ? contextType : ""}`;
  const lastPersistedAt = lastDebugPersistAtByKey.get(key);

  if (
    lastPersistedAt !== undefined &&
    record.created_at - lastPersistedAt < DEBUG_PERSIST_SUPPRESSION_WINDOW_MS
  ) {
    return false;
  }

  if (lastDebugPersistAtByKey.size >= DEBUG_PERSIST_KEY_LIMIT) {
    for (const [staleKey, persistedAt] of lastDebugPersistAtByKey) {
      if (record.created_at - persistedAt >= DEBUG_PERSIST_SUPPRESSION_WINDOW_MS) {
        lastDebugPersistAtByKey.delete(staleKey);
      }
    }

    if (lastDebugPersistAtByKey.size >= DEBUG_PERSIST_KEY_LIMIT) {
      lastDebugPersistAtByKey.clear();
    }
  }

  lastDebugPersistAtByKey.set(key, record.created_at);
  return true;
}

function schedulePrune(): Promise<void> {
  if (prunePromise !== null) {
    return prunePromise;
  }

  prunePromise = pruneLogRecords(MAX_LOG_RECORDS).finally(() => {
    prunePromise = null;
  });

  return prunePromise;
}

function normalizeMessage(value: string | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed.slice(0, 400);
}

function normalizeRequestId(value: string | null | undefined): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function normalizeContext(value: Record<string, unknown> | undefined): LogContext {
  if (value === undefined) {
    return {};
  }

  const normalizedContext: LogContext = {};

  for (const [key, item] of Object.entries(value)) {
    const normalizedValue = normalizeContextValue(item);

    if (normalizedValue === undefined) {
      continue;
    }

    normalizedContext[key] = normalizedValue;
  }

  return normalizedContext;
}

function normalizeContextValue(value: unknown): LogContext[keyof LogContext] | undefined {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null
  ) {
    return typeof value === "string" ? value.slice(0, 300) : value;
  }

  if (value instanceof Error) {
    return value.message.slice(0, 300);
  }

  if (value === undefined) {
    return undefined;
  }

  try {
    return JSON.stringify(value).slice(0, 300);
  } catch {
    return String(value).slice(0, 300);
  }
}

function mirrorToConsole(record: LogRecord): void {
  const consoleMessage = `[${record.scope}] ${record.event}`;

  switch (record.level) {
    case "debug":
      console.debug(consoleMessage, record);
      return;
    case "info":
      console.info(consoleMessage, record);
      return;
    case "warn":
      console.warn(consoleMessage, record);
      return;
    case "error":
      console.error(consoleMessage, record);
      return;
  }
}
