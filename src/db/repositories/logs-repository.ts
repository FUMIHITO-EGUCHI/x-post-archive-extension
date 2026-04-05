import { archiveDb, isMissingObjectStoreError } from "../archive-database";
import type { LogLevel, LogListFilter, LogRecord } from "../../types/logger";

export async function addLogRecord(record: LogRecord): Promise<void> {
  try {
    await archiveDb.logs.add(record);
  } catch (error) {
    if (isMissingObjectStoreError(error)) {
      return;
    }

    throw error;
  }
}

export async function listLogRecords(filter: LogListFilter = {}): Promise<LogRecord[]> {
  const lowerBound = normalizeLowerBound(filter.from);
  const upperBound = normalizeUpperBound(filter.to);
  const limit = normalizeLimit(filter.limit);
  const levels = normalizeLevels(filter);

  try {
    if (levels !== null && levels.length === 1) {
      return archiveDb.logs
        .where("[level+created_at]")
        .between([levels[0], lowerBound], [levels[0], upperBound])
        .reverse()
        .limit(limit)
        .toArray();
    }

    const records = await archiveDb.logs
      .where("created_at")
      .between(lowerBound, upperBound)
      .reverse()
      .toArray();

    if (levels === null) {
      return records.slice(0, limit);
    }

    const allowedLevels = new Set(levels);
    return records.filter((record) => allowedLevels.has(record.level)).slice(0, limit);
  } catch (error) {
    if (isMissingObjectStoreError(error)) {
      return [];
    }

    throw error;
  }
}

export async function pruneLogRecords(maxCount: number): Promise<void> {
  const normalizedMaxCount = Math.max(0, Math.trunc(maxCount));

  try {
    const removableKeys = await archiveDb.logs
      .orderBy("created_at")
      .reverse()
      .offset(normalizedMaxCount)
      .primaryKeys();

    if (removableKeys.length === 0) {
      return;
    }

    await archiveDb.logs.bulkDelete(removableKeys as string[]);
  } catch (error) {
    if (isMissingObjectStoreError(error)) {
      return;
    }

    throw error;
  }
}

export async function clearLogRecords(): Promise<void> {
  try {
    await archiveDb.logs.clear();
  } catch (error) {
    if (isMissingObjectStoreError(error)) {
      return;
    }

    throw error;
  }
}

function normalizeLowerBound(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function normalizeUpperBound(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
}

function normalizeLimit(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 200;
  }

  return Math.min(Math.max(Math.trunc(value), 1), 500);
}

function normalizeLevels(filter: LogListFilter): LogLevel[] | null {
  if (Array.isArray(filter.levels)) {
    const uniqueLevels = [...new Set(filter.levels.filter(isLogLevel))];
    return uniqueLevels.length > 0 ? uniqueLevels : [];
  }

  if (filter.level !== undefined && filter.level !== null) {
    return isLogLevel(filter.level) ? [filter.level] : [];
  }

  return null;
}

function isLogLevel(value: unknown): value is LogLevel {
  return value === "debug" || value === "info" || value === "warn" || value === "error";
}
