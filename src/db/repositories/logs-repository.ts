import { archiveDb } from "../archive-database";
import type { LogListFilter, LogRecord } from "../../types/logger";

export async function addLogRecord(record: LogRecord): Promise<void> {
  await archiveDb.logs.add(record);
}

export async function listLogRecords(filter: LogListFilter = {}): Promise<LogRecord[]> {
  const lowerBound = normalizeLowerBound(filter.from);
  const upperBound = normalizeUpperBound(filter.to);
  const limit = normalizeLimit(filter.limit);

  if (filter.level !== undefined && filter.level !== null) {
    return archiveDb.logs
      .where("[level+created_at]")
      .between([filter.level, lowerBound], [filter.level, upperBound])
      .reverse()
      .limit(limit)
      .toArray();
  }

  return archiveDb.logs
    .where("created_at")
    .between(lowerBound, upperBound)
    .reverse()
    .limit(limit)
    .toArray();
}

export async function pruneLogRecords(maxCount: number): Promise<void> {
  const normalizedMaxCount = Math.max(0, Math.trunc(maxCount));

  const removableKeys = await archiveDb.logs
    .orderBy("created_at")
    .reverse()
    .offset(normalizedMaxCount)
    .primaryKeys();

  if (removableKeys.length === 0) {
    return;
  }

  await archiveDb.logs.bulkDelete(removableKeys as string[]);
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
