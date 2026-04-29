import {
  deleteThreadExpandQueueRecord,
  dequeueNextPendingThreadExpand,
  getTweetDetailTemplate,
  listThreadExpandQueueRecordsByStatus,
  markThreadExpandFailed,
  markThreadExpandInProgress,
  markThreadExpandPendingRetry
} from "../../db/repositories/thread-repository";
import type { ThreadExpandQueueRecord } from "../../types/thread";
import { createLogger } from "../logging/logger";
import { saveThread } from "./archive-service";
import { fetchTweetDetail } from "../x/tweet-detail-client";

const THREAD_EXPAND_THROTTLE_MS = 5_000;
const THREAD_EXPAND_BACKOFF_MS = [5_000, 30_000, 5 * 60_000] as const;
const THREAD_EXPAND_MAX_FAILED_ATTEMPTS = THREAD_EXPAND_BACKOFF_MS.length;

const logger = createLogger("thread-expand");

let processingPromise: Promise<void> | null = null;
let scheduledResumeTimer: ReturnType<typeof globalThis.setTimeout> | null = null;
let lastRequestStartedAt = 0;

export async function resumeThreadExpandProcessing(): Promise<void> {
  if (processingPromise !== null) {
    return processingPromise;
  }

  clearScheduledResume();

  const nextRecord = await dequeueNextPendingThreadExpand();

  if (nextRecord === undefined) {
    await scheduleNextPendingResume();
    return;
  }

  processingPromise = runThreadExpandLoop().finally(() => {
    processingPromise = null;
  });

  return processingPromise;
}

export function getThreadExpandBackoffMs(retryCount: number): number | null {
  return THREAD_EXPAND_BACKOFF_MS[retryCount] ?? null;
}

async function runThreadExpandLoop(): Promise<void> {
  while (true) {
    const nextRecord = await dequeueNextPendingThreadExpand();

    if (nextRecord === undefined) {
      await scheduleNextPendingResume();
      return;
    }

    await waitForThrottleWindow();
    await processThreadExpandRecord(nextRecord);
  }
}

async function processThreadExpandRecord(record: ThreadExpandQueueRecord): Promise<void> {
  if (record.id === undefined) {
    logger.warn("thread_expand.record_missing_id", {
      context: {
        candidatePostId: record.candidate_post_id,
        threadRootId: record.thread_root_id
      }
    });
    return;
  }

  const attempt = record.retry_count + 1;

  try {
    await markThreadExpandInProgress(record.id);
    lastRequestStartedAt = Date.now();

    const result = await fetchTweetDetail(record.candidate_post_id, {
      getTemplate: getTweetDetailTemplate
    });

    if (!result.ok) {
      throw new Error(result.error);
    }

    if (result.posts.length === 0) {
      throw new Error("TweetDetail returned no OP self-reply chain.");
    }

    const saveResult = await saveThread(result.posts, {
      traceId: `thread-expand:${record.thread_root_id}:${attempt}`,
      enqueueThreadExpand: false
    });

    if (saveResult.failed > 0) {
      throw new Error(`Failed to save ${saveResult.failed} thread post(s).`);
    }

    await deleteThreadExpandQueueRecord(record.id);

    logger.info("thread_expand.completed", {
      context: {
        candidatePostId: record.candidate_post_id,
        threadRootId: record.thread_root_id,
        attempt,
        saved: saveResult.saved,
        skipped: saveResult.skipped,
        postCount: result.posts.length
      }
    });
  } catch (error) {
    await handleThreadExpandFailure(record, attempt, error);
  }
}

async function handleThreadExpandFailure(
  record: ThreadExpandQueueRecord,
  attempt: number,
  error: unknown
): Promise<void> {
  if (record.id === undefined) {
    return;
  }

  const message = error instanceof Error ? error.message : "Thread expansion failed.";
  const now = Date.now();
  const backoffMs = getThreadExpandBackoffMs(record.retry_count);

  if (attempt >= THREAD_EXPAND_MAX_FAILED_ATTEMPTS || backoffMs === null) {
    await markThreadExpandFailed(record.id, message, now + (backoffMs ?? 0), now);

    logger.error("thread_expand.failed", {
      message: "Thread expansion failed permanently.",
      context: {
        candidatePostId: record.candidate_post_id,
        threadRootId: record.thread_root_id,
        attempt,
        nextAttemptAt: now + (backoffMs ?? 0),
        error: message
      }
    });
    return;
  }

  const nextAttemptAt = now + backoffMs;
  await markThreadExpandPendingRetry(record.id, message, nextAttemptAt, now);

  logger.warn("thread_expand.retry_scheduled", {
    message: "Thread expansion failed; retry scheduled.",
    context: {
      candidatePostId: record.candidate_post_id,
      threadRootId: record.thread_root_id,
      attempt,
      backoffMs,
      nextAttemptAt,
      error: message
    }
  });
}

async function waitForThrottleWindow(): Promise<void> {
  const remainingMs = lastRequestStartedAt + THREAD_EXPAND_THROTTLE_MS - Date.now();

  if (remainingMs > 0) {
    await wait(remainingMs);
  }
}

async function scheduleNextPendingResume(): Promise<void> {
  clearScheduledResume();

  const pendingRecords = await listThreadExpandQueueRecordsByStatus("pending");
  const nextAttemptAt = pendingRecords.reduce<number | null>((earliest, record) => {
    if (earliest === null) {
      return record.next_attempt_at;
    }

    return Math.min(earliest, record.next_attempt_at);
  }, null);

  if (nextAttemptAt === null) {
    return;
  }

  const delayMs = Math.max(0, nextAttemptAt - Date.now());
  scheduledResumeTimer = globalThis.setTimeout(() => {
    scheduledResumeTimer = null;
    void resumeThreadExpandProcessing();
  }, delayMs);
}

function clearScheduledResume(): void {
  if (scheduledResumeTimer === null) {
    return;
  }

  globalThis.clearTimeout(scheduledResumeTimer);
  scheduledResumeTimer = null;
}

function wait(durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, durationMs);
  });
}
