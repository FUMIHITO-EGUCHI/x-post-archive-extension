import {
  getPost,
  listPostIds,
  listPostIdsWithZeroEngagementCounts
} from "../../db/repositories/posts-repository";
import {
  bulkUpsertPendingRefetchQueueRecords,
  deleteAllRefetchQueueRecords,
  getNextPendingRefetchQueueRecord,
  listRefetchQueueRecords,
  updateRefetchQueueRecord
} from "../../db/repositories/refetch-queue-repository";
import type {
  RefetchCheckMessage,
  RefetchCheckResponse,
  RefetchCompletePayload,
  RefetchQueuePriority,
  RefetchStatusRecord
} from "../../types/refetch";
import { DEFAULT_REFETCH_STATUS } from "../../types/refetch";
import { refetchArchivePost } from "../archive/archive-service";
import { createLogger } from "../logging/logger";

const REFETCH_TAB_TRIGGER_INTERVAL_MS = 500;
const REFETCH_WAIT_NO_PROGRESS_TIMEOUT_MS = 15_000;
const REFETCH_WAIT_HARD_TIMEOUT_MS = 90_000;
const REFETCH_NAVIGATION_TIMEOUT_MS = 30_000;
const REFETCH_TAB_URL = "https://x.com/home";

type PendingRefetchResult = {
  resolve: (payload: RefetchCompletePayload) => void;
};

const logger = createLogger("refetch");

let processingPromise: Promise<void> | null = null;
let currentPostId: string | null = null;
let currentAttempt: number | null = null;
let stopRequested = false;
let stoppedWithPendingQueue = false;
let refetchTabId: number | null = null;
let totalDurationMs = 0;
let completedDurationCount = 0;
const pendingResults = new Map<string, PendingRefetchResult>();

export async function enqueueRefetchPosts(input: {
  xPostIds?: string[];
  enqueueAll?: boolean;
  enqueueZeroEngagement?: boolean;
  priority: RefetchQueuePriority;
}): Promise<{
  enqueuedCount: number;
  status: RefetchStatusRecord;
}> {
  stopRequested = false;
  stoppedWithPendingQueue = false;

  const targetPostIds = input.enqueueZeroEngagement
    ? await listPostIdsWithZeroEngagementCounts()
    : input.enqueueAll
      ? await listPostIds()
      : [...new Set(input.xPostIds ?? [])];
  logger.info("refetch.enqueue.prepared", {
    context: {
      enqueueAll: input.enqueueAll ?? false,
      enqueueZeroEngagement: input.enqueueZeroEngagement ?? false,
      explicitPostCount: input.xPostIds?.length ?? 0,
      targetPostCount: targetPostIds.length,
      priority: input.priority
    }
  });
  const enqueuedCount = await bulkUpsertPendingRefetchQueueRecords(targetPostIds, input.priority);

  void resumeRefetchProcessing({
    force: true
  });

  return {
    enqueuedCount,
    status: await getRefetchStatus()
  };
}

export async function getRefetchStatus(): Promise<RefetchStatusRecord> {
  const queueRecords = await listRefetchQueueRecords();
  const pendingCount = queueRecords.filter((record) => record.status === "pending").length;
  const completedCount = queueRecords.filter((record) => record.status === "done").length;
  const failedCount = queueRecords.filter((record) => record.status === "error").length;
  const totalCount = queueRecords.length;
  const averageDurationMs =
    completedDurationCount > 0 ? Math.round(totalDurationMs / completedDurationCount) : null;
  const estimatedRemainingMs =
    averageDurationMs === null ? null : averageDurationMs * pendingCount;

  if (totalCount === 0) {
    return {
      ...DEFAULT_REFETCH_STATUS
    };
  }

  return {
    phase:
      processingPromise !== null
        ? "running"
        : stoppedWithPendingQueue && pendingCount > 0
        ? "stopped"
        : "idle",
    currentPostId,
    currentAttempt,
    pendingCount,
    completedCount,
    failedCount,
    totalCount,
    stopRequested,
    averageDurationMs,
    estimatedRemainingMs
  };
}

export async function cancelRefetch(): Promise<RefetchStatusRecord> {
  stopRequested = true;
  return getRefetchStatus();
}

export async function clearRefetchQueue(): Promise<RefetchStatusRecord> {
  if (processingPromise !== null) {
    stopRequested = true;
    throw new Error("Cannot clear the refetch queue while processing is running.");
  }

  await deleteAllRefetchQueueRecords();
  stoppedWithPendingQueue = false;
  totalDurationMs = 0;
  completedDurationCount = 0;

  return getRefetchStatus();
}

export async function resumeRefetchProcessing(
  options: {
    force?: boolean;
  } = {}
): Promise<void> {
  if (processingPromise !== null) {
    return processingPromise;
  }

  if (stoppedWithPendingQueue && options.force !== true) {
    return;
  }

  const nextRecord = await getNextPendingRefetchQueueRecord();

  if (nextRecord === undefined || stopRequested) {
    return;
  }

  processingPromise = runRefetchLoop().finally(() => {
    processingPromise = null;
    currentPostId = null;
    currentAttempt = null;
  });

  return processingPromise;
}

export function completeRefetchFromContentScript(
  payload: RefetchCompletePayload,
  senderTabId: number | null
): boolean {
  if (payload.xPostId !== currentPostId) {
    return false;
  }

  if (refetchTabId !== null && senderTabId !== refetchTabId) {
    return false;
  }

  const pending = pendingResults.get(payload.xPostId);

  if (pending === undefined) {
    return false;
  }

  pendingResults.delete(payload.xPostId);
  pending.resolve(payload);
  return true;
}

async function runRefetchLoop(): Promise<void> {
  while (!stopRequested) {
    const nextRecord = await getNextPendingRefetchQueueRecord();

    if (nextRecord === undefined) {
      break;
    }

    currentPostId = nextRecord.x_post_id;
    currentAttempt = nextRecord.attempts + 1;
    const startedAt = Date.now();

    try {
      await updateRefetchQueueRecord(nextRecord.x_post_id, {
        attempts: currentAttempt,
        last_error: null,
        completed_at: null
      });

      const existingPost = await getPost(nextRecord.x_post_id);

      if (existingPost === undefined) {
        throw new Error("Saved post not found.");
      }

      const tabId = await navigateRefetchTab(existingPost.post_url);
      const payload = await extractPostFromRefetchTab(tabId, nextRecord.x_post_id);

      if (payload.post === null) {
        throw new Error(payload.error ?? "Post extraction failed.");
      }

      await refetchArchivePost(nextRecord.x_post_id, payload.post, {
        traceId: `refetch:${nextRecord.x_post_id}:${currentAttempt}`
      });

      await updateRefetchQueueRecord(nextRecord.x_post_id, {
        status: "done",
        completed_at: Date.now(),
        last_error: null
      });
      totalDurationMs += Date.now() - startedAt;
      completedDurationCount += 1;

      logger.info("refetch.post.completed", {
        context: {
          xPostId: nextRecord.x_post_id,
          attempt: currentAttempt,
          tabId
        }
      });
    } catch (error) {
      await updateRefetchQueueRecord(nextRecord.x_post_id, {
        status: "error",
        completed_at: Date.now(),
        last_error: error instanceof Error ? error.message : "Refetch failed."
      });

      logger.error("refetch.post.failed", {
        message: "Post refetch failed.",
        context: {
          xPostId: nextRecord.x_post_id,
          attempt: currentAttempt,
          error
        }
      });
    }
  }

  const hasPendingQueue = (await getRefetchStatus()).pendingCount > 0;
  stoppedWithPendingQueue = stopRequested && hasPendingQueue;
  stopRequested = false;
}

async function navigateRefetchTab(postUrl: string): Promise<number> {
  const targetTabId = await ensureRefetchTab();

  await browser.tabs.update(targetTabId, {
    url: postUrl,
    active: false
  });
  await waitForTabComplete(targetTabId, postUrl);

  return targetTabId;
}

async function ensureRefetchTab(): Promise<number> {
  if (refetchTabId !== null) {
    try {
      await browser.tabs.get(refetchTabId);
      return refetchTabId;
    } catch {
      refetchTabId = null;
    }
  }

  const tab = await browser.tabs.create({
    url: REFETCH_TAB_URL,
    active: false
  });

  if (tab.id === undefined) {
    throw new Error("Failed to create a refetch tab.");
  }

  refetchTabId = tab.id;
  await waitForTabComplete(tab.id, REFETCH_TAB_URL);
  return tab.id;
}

async function waitForTabComplete(tabId: number, expectedUrl: string): Promise<void> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < REFETCH_NAVIGATION_TIMEOUT_MS) {
    const tab = await browser.tabs.get(tabId);

    if (tab.status === "complete" && isExpectedTabUrl(tab.url, expectedUrl)) {
      return;
    }

    await wait(250);
  }

  throw new Error("Timed out while waiting for the refetch tab to load.");
}

function isExpectedTabUrl(tabUrl: string | undefined, expectedUrl: string): boolean {
  if (typeof tabUrl !== "string" || tabUrl.trim() === "") {
    return false;
  }

  return trimTrailingSlash(tabUrl) === trimTrailingSlash(expectedUrl);
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/u, "");
}

async function extractPostFromRefetchTab(
  tabId: number,
  xPostId: string
): Promise<RefetchCompletePayload> {
  const completionPromise = new Promise<RefetchCompletePayload>((resolve) => {
    pendingResults.set(xPostId, {
      resolve
    });
  });
  const hardDeadline = Date.now() + REFETCH_WAIT_HARD_TIMEOUT_MS;
  let lastProgressAt = Date.now();
  let previousResponse: RefetchCheckResponse | null = null;

  while (
    Date.now() < hardDeadline &&
    Date.now() - lastProgressAt < REFETCH_WAIT_NO_PROGRESS_TIMEOUT_MS
  ) {
    let checkResponse: RefetchCheckResponse | null = null;

    try {
      const response = await browser.tabs.sendMessage(tabId, {
        type: "refetch.check",
        xPostId
      } satisfies RefetchCheckMessage);

      if (isRefetchCheckResponse(response)) {
        checkResponse = response;
      }
    } catch {
      // The content script may not be ready yet; keep polling until timeout.
    }

    if (hasRefetchProgress(previousResponse, checkResponse)) {
      lastProgressAt = Date.now();
    }

    if (checkResponse !== null) {
      previousResponse = checkResponse;
    }

    const remainingMs = hardDeadline - Date.now();
    const result = await Promise.race([
      completionPromise,
      wait(Math.min(REFETCH_TAB_TRIGGER_INTERVAL_MS, remainingMs)).then(() => null)
    ]);

    if (result !== null) {
      pendingResults.delete(xPostId);
      return result;
    }
  }

  pendingResults.delete(xPostId);

  if (previousResponse?.waitingForMedia === true) {
    throw new Error("Media did not materialize in the inactive refetch tab before timeout.");
  }

  throw new Error("Timed out while waiting for the X page to expose the target post.");
}

function wait(durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, durationMs);
  });
}

function isRefetchCheckResponse(value: unknown): value is RefetchCheckResponse {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof Reflect.get(value, "found") === "boolean" &&
    typeof Reflect.get(value, "extracted") === "boolean" &&
    typeof Reflect.get(value, "waitingForMedia") === "boolean" &&
    typeof Reflect.get(value, "imageHintCount") === "number" &&
    typeof Reflect.get(value, "videoHintCount") === "number" &&
    typeof Reflect.get(value, "savableMediaCount") === "number" &&
    typeof Reflect.get(value, "warmupApplied") === "boolean"
  );
}

function hasRefetchProgress(
  previousResponse: RefetchCheckResponse | null,
  nextResponse: RefetchCheckResponse | null
): boolean {
  if (nextResponse === null) {
    return false;
  }

  if (previousResponse === null) {
    return nextResponse.found || nextResponse.extracted || nextResponse.warmupApplied;
  }

  return (
    (previousResponse.found === false && nextResponse.found === true) ||
    nextResponse.savableMediaCount > previousResponse.savableMediaCount ||
    nextResponse.imageHintCount !== previousResponse.imageHintCount ||
    nextResponse.videoHintCount !== previousResponse.videoHintCount ||
    (previousResponse.warmupApplied === false && nextResponse.warmupApplied === true)
  );
}
