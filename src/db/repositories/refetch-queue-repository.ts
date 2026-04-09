import { archiveDb } from "../archive-database";
import type {
  RefetchQueuePriority,
  RefetchQueueRecord,
  RefetchQueueStatus
} from "../../types/refetch";

export async function getRefetchQueueRecord(
  xPostId: string
): Promise<RefetchQueueRecord | undefined> {
  return archiveDb.refetch_queue.get(xPostId);
}

export async function putRefetchQueueRecord(record: RefetchQueueRecord): Promise<void> {
  await archiveDb.refetch_queue.put(record);
}

export async function updateRefetchQueueRecord(
  xPostId: string,
  update: Partial<RefetchQueueRecord>
): Promise<void> {
  await archiveDb.refetch_queue.update(xPostId, update);
}

export async function listRefetchQueueRecords(): Promise<RefetchQueueRecord[]> {
  return archiveDb.refetch_queue.toArray();
}

export async function deleteAllRefetchQueueRecords(): Promise<void> {
  await archiveDb.refetch_queue.clear();
}

export async function listRefetchQueueRecordsByStatus(
  status: RefetchQueueStatus
): Promise<RefetchQueueRecord[]> {
  return archiveDb.refetch_queue.where("status").equals(status).toArray();
}

export async function getNextPendingRefetchQueueRecord(): Promise<RefetchQueueRecord | undefined> {
  const pending = await listRefetchQueueRecordsByStatus("pending");

  return [...pending].sort(compareRefetchQueueRecords)[0];
}

export async function upsertPendingRefetchQueueRecord(
  xPostId: string,
  priority: RefetchQueuePriority
): Promise<boolean> {
  const existing = await getRefetchQueueRecord(xPostId);

  if (existing !== undefined && existing.status === "pending" && existing.priority >= priority) {
    return false;
  }

  await putRefetchQueueRecord({
    x_post_id: xPostId,
    status: "pending",
    priority: maxRefetchPriority(existing?.priority ?? 0, priority),
    enqueued_at: Date.now(),
    attempts: existing?.status === "pending" ? existing.attempts : 0,
    completed_at: null,
    last_error: null
  });

  return true;
}

export async function bulkUpsertPendingRefetchQueueRecords(
  xPostIds: string[],
  priority: RefetchQueuePriority
): Promise<number> {
  if (xPostIds.length === 0) {
    return 0;
  }

  const existingRecords = await listRefetchQueueRecords();
  const existingMap = new Map(existingRecords.map((r) => [r.x_post_id, r]));
  const now = Date.now();
  const recordsToUpsert: RefetchQueueRecord[] = [];

  for (const xPostId of xPostIds) {
    const existing = existingMap.get(xPostId);

    if (existing !== undefined && existing.status === "pending" && existing.priority >= priority) {
      continue;
    }

    recordsToUpsert.push({
      x_post_id: xPostId,
      status: "pending",
      priority: maxRefetchPriority(existing?.priority ?? 0, priority),
      enqueued_at: now,
      attempts: existing?.status === "pending" ? existing.attempts : 0,
      completed_at: null,
      last_error: null
    });
  }

  if (recordsToUpsert.length > 0) {
    await archiveDb.refetch_queue.bulkPut(recordsToUpsert);
  }

  return recordsToUpsert.length;
}

function compareRefetchQueueRecords(left: RefetchQueueRecord, right: RefetchQueueRecord): number {
  if (left.priority !== right.priority) {
    return right.priority - left.priority;
  }

  return left.enqueued_at - right.enqueued_at;
}

function maxRefetchPriority(
  left: RefetchQueuePriority,
  right: RefetchQueuePriority
): RefetchQueuePriority {
  return left >= right ? left : right;
}
