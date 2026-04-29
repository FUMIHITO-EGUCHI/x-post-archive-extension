import { archiveDb } from "../archive-database";
import type {
  ThreadExpandQueueRecord,
  ThreadExpandQueueStatus,
  TweetDetailTemplateRecord
} from "../../types/thread";

export type EnqueueThreadExpandInput = {
  candidate_post_id: string;
  thread_root_id: string;
  next_attempt_at?: number;
};

export async function enqueueThreadExpand(
  input: EnqueueThreadExpandInput,
  now = Date.now()
): Promise<ThreadExpandQueueRecord> {
  const existing = await getThreadExpandQueueRecordByRoot(input.thread_root_id);
  const nextAttemptAt = normalizeTimestamp(input.next_attempt_at, now);

  if (existing !== undefined) {
    if (existing.status === "pending" || existing.status === "in_progress") {
      return existing;
    }

    const updated: ThreadExpandQueueRecord = {
      ...existing,
      candidate_post_id: input.candidate_post_id,
      status: "pending",
      retry_count: 0,
      last_error: null,
      updated_at: now,
      next_attempt_at: nextAttemptAt
    };

    await archiveDb.thread_expand_queue.put(updated);
    return updated;
  }

  const record: ThreadExpandQueueRecord = {
    candidate_post_id: input.candidate_post_id,
    thread_root_id: input.thread_root_id,
    status: "pending",
    retry_count: 0,
    last_error: null,
    created_at: now,
    updated_at: now,
    next_attempt_at: nextAttemptAt
  };
  const id = await archiveDb.thread_expand_queue.add(record);

  return {
    ...record,
    id
  };
}

export async function getThreadExpandQueueRecord(
  id: number
): Promise<ThreadExpandQueueRecord | undefined> {
  return archiveDb.thread_expand_queue.get(id);
}

export async function getThreadExpandQueueRecordByRoot(
  threadRootId: string
): Promise<ThreadExpandQueueRecord | undefined> {
  return archiveDb.thread_expand_queue.where("thread_root_id").equals(threadRootId).first();
}

export async function listThreadExpandQueueRecordsByStatus(
  status: ThreadExpandQueueStatus
): Promise<ThreadExpandQueueRecord[]> {
  return archiveDb.thread_expand_queue.where("status").equals(status).toArray();
}

export async function dequeueNextPendingThreadExpand(
  now = Date.now()
): Promise<ThreadExpandQueueRecord | undefined> {
  const pending = await archiveDb.thread_expand_queue
    .where("status")
    .equals("pending")
    .filter((record) => record.next_attempt_at <= now)
    .toArray();

  return pending.sort(compareThreadExpandQueueRecords)[0];
}

export async function markThreadExpandInProgress(id: number, now = Date.now()): Promise<void> {
  await archiveDb.thread_expand_queue.update(id, {
    status: "in_progress",
    updated_at: now
  });
}

export async function markThreadExpandFailed(
  id: number,
  error: string,
  nextAttemptAt: number,
  now = Date.now()
): Promise<void> {
  const existing = await getThreadExpandQueueRecord(id);

  await archiveDb.thread_expand_queue.update(id, {
    status: "failed",
    retry_count: (existing?.retry_count ?? 0) + 1,
    last_error: error,
    updated_at: now,
    next_attempt_at: nextAttemptAt
  });
}

export async function markThreadExpandPendingRetry(
  id: number,
  error: string,
  nextAttemptAt: number,
  now = Date.now()
): Promise<void> {
  const existing = await getThreadExpandQueueRecord(id);

  await archiveDb.thread_expand_queue.update(id, {
    status: "pending",
    retry_count: (existing?.retry_count ?? 0) + 1,
    last_error: error,
    updated_at: now,
    next_attempt_at: nextAttemptAt
  });
}

export async function deleteThreadExpandQueueRecord(id: number): Promise<void> {
  await archiveDb.thread_expand_queue.delete(id);
}

export async function clearThreadExpandQueueRecords(): Promise<void> {
  await archiveDb.thread_expand_queue.clear();
}

export async function getTweetDetailTemplate(): Promise<
  TweetDetailTemplateRecord | undefined
> {
  return archiveDb.tweet_detail_template.get("current");
}

export async function setTweetDetailTemplate(
  template: Omit<TweetDetailTemplateRecord, "id">
): Promise<TweetDetailTemplateRecord> {
  const record: TweetDetailTemplateRecord = {
    id: "current",
    ...template
  };

  await archiveDb.tweet_detail_template.put(record);

  return record;
}

export async function clearTweetDetailTemplate(): Promise<void> {
  await archiveDb.tweet_detail_template.delete("current");
}

function compareThreadExpandQueueRecords(
  left: ThreadExpandQueueRecord,
  right: ThreadExpandQueueRecord
): number {
  if (left.next_attempt_at !== right.next_attempt_at) {
    return left.next_attempt_at - right.next_attempt_at;
  }

  return left.created_at - right.created_at;
}

function normalizeTimestamp(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
