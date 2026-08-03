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

type DebugPersistEntry = {
  persistedAt: number;
  suppressedCount: number;
};

const debugPersistEntriesByKey = new Map<string, DebugPersistEntry>();

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
      if (level === "debug") {
        rollbackDebugPersistMark(record);
      }

      console.error("App logger failed to persist a record.", {
        level,
        scope,
        event,
        error
      });
    });
}

// Returns true when the record should be persisted, recording it as the latest persist for its
// key. Suppressed records are counted, and the next persisted record for the key carries the
// count as context.debug_suppressed_count so the persisted log shows "N events elided" instead
// of a silent gap — the persisted log is the only forensic trail once a SW dies (#112).
function checkAndMarkDebugPersist(record: LogRecord): boolean {
  const key = buildDebugPersistKey(record);
  const entry = debugPersistEntriesByKey.get(key);

  if (entry !== undefined) {
    const elapsed = record.created_at - entry.persistedAt;

    // A negative elapsed means the wall clock jumped backwards (e.g. NTP correction). Treat
    // the window as expired instead of suppressing until the clock catches up again.
    if (elapsed >= 0 && elapsed < DEBUG_PERSIST_SUPPRESSION_WINDOW_MS) {
      entry.suppressedCount += 1;
      return false;
    }

    if (entry.suppressedCount > 0) {
      record.context["debug_suppressed_count"] = entry.suppressedCount;
    }
  } else if (debugPersistEntriesByKey.size >= DEBUG_PERSIST_KEY_LIMIT) {
    evictDebugPersistEntries(record.created_at);
  }

  debugPersistEntriesByKey.set(key, {
    persistedAt: record.created_at,
    suppressedCount: 0
  });
  return true;
}

// Include context.type (the runtime message discriminator) so distinct message kinds sharing an
// event name (e.g. runtime.message.received) do not suppress each other. JSON-encoding the
// segments keeps boundaries unambiguous for any scope/event content; a non-string context.type
// maps to null so it cannot masquerade as "no type".
function buildDebugPersistKey(record: LogRecord): string {
  const contextType = record.context["type"];
  return JSON.stringify([
    record.scope,
    record.event,
    typeof contextType === "string" ? contextType : null
  ]);
}

function evictDebugPersistEntries(now: number): void {
  // Dropping entries whose window already expired (or sits in the future after a clock jump)
  // is behavior-neutral: those keys would persist their next record anyway.
  for (const [key, entry] of debugPersistEntriesByKey) {
    const elapsed = now - entry.persistedAt;

    if (elapsed < 0 || elapsed >= DEBUG_PERSIST_SUPPRESSION_WINDOW_MS) {
      debugPersistEntriesByKey.delete(key);
    }
  }

  if (debugPersistEntriesByKey.size < DEBUG_PERSIST_KEY_LIMIT) {
    return;
  }

  // Every key is hot. Evict only the oldest half — clearing the whole map would re-persist
  // every hot key at once, the exact IDB write burst the suppression exists to avoid (#112).
  const oldestFirst = [...debugPersistEntriesByKey.entries()].sort(
    (a, b) => a[1].persistedAt - b[1].persistedAt
  );

  for (const [key] of oldestFirst.slice(0, Math.ceil(oldestFirst.length / 2))) {
    debugPersistEntriesByKey.delete(key);
  }
}

// Why: the persist failed (#112's frozen-IDB case is exactly this path), so keeping the mark
// would suppress the key for a whole window with nothing actually persisted. Only unmark when
// no newer record has persisted for the key in the meantime.
function rollbackDebugPersistMark(record: LogRecord): void {
  const key = buildDebugPersistKey(record);
  const entry = debugPersistEntriesByKey.get(key);

  if (entry !== undefined && entry.persistedAt === record.created_at) {
    debugPersistEntriesByKey.delete(key);
  }
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
