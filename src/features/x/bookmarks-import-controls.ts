import {
  requestClearLogs,
  requestDebugLog,
  requestSavePost
} from "../runtime/client";
import { loadDebugInspectPostIds } from "../debug/debug-settings";
import {
  detectDefaultArchiveLanguage,
  buildLocalizedDefaultAutoTags,
  loadArchiveLanguage,
  type ArchiveLanguage
} from "../settings/archive-language";
import { loadArchiveSettings } from "../settings/archive-settings";
import {
  type ExtractedPostBundle,
  extractPostFromArticle,
  extractPostIdFromArticle,
  inspectArticleMediaSignals
} from "./extract-post-from-article";
import { findTweetArticles } from "./find-tweet-articles";
import {
  DEFAULT_BULK_IMPORT_DUPLICATE_BATCH_THRESHOLD,
  type SavePostInput
} from "../../types/archive";

const ROOT_ID = "xpa-bookmarks-import-root";
const OVERLAY_ID = "xpa-bookmarks-import-overlay";
const TOGGLE_BUTTON_ID = "xpa-bookmarks-import-toggle";
const ACTION_BUTTON_ID = "xpa-bookmarks-import-action";

const MAX_IDLE_PASSES = 6;
const MAX_SCROLL_STEPS = 400;
const MIN_SCROLL_WAIT_MS = 180;
const MAX_SCROLL_WAIT_MS = 900;
const SAVE_BATCH_SIZE = 12;
const MEDIA_WAIT_PASS_LIMIT = 4;
const MAX_WAITING_POSTS_BEFORE_SCROLL_PAUSE = 6;
const WAITING_PAUSE_MS = 700;

let rootElement: HTMLDivElement | null = null;
let currentRun: BookmarksImportRun | null = null;
let overlayExpanded = false;
let overlayLanguage: ArchiveLanguage = detectDefaultArchiveLanguage();
let lastOverlayStats: OverlayStats = createDefaultOverlayStats();

type OverlayStatus =
  | "idle"
  | "collecting"
  | "saving"
  | "stopping"
  | "stopped"
  | "completed"
  | "failed";

type ImportStopReason = "none" | "manual" | "left-page" | "duplicate-threshold";

type OverlayStats = {
  status: OverlayStatus;
  collected: number;
  saved: number;
  duplicates: number;
  failed: number;
  scanned: number;
  waiting: number;
  stopReason: ImportStopReason;
  duplicateBatchStreak: number;
  duplicateBatchThreshold: number;
  message: string;
};

type BookmarksImportRun = {
  stopRequested: boolean;
  collectingFinished: boolean;
  stopReason: ImportStopReason;
  duplicateBatchStreak: number;
  duplicateBatchThreshold: number;
  traceId: string;
  inspectPostIds: Set<string>;
  inspectSignatures: Map<string, string>;
  stats: OverlayStats;
};

type PendingMediaWaitState = {
  xPostId: string;
  firstSeenAt: number;
  waitPasses: number;
  mediaHintCount: number;
};

type QueuedPostBundle = ExtractedPostBundle & {
  post: SavePostInput;
  quotedPost: SavePostInput | null;
};

export function isBookmarksTimelinePage(currentUrl = window.location.href): boolean {
  try {
    const url = new URL(currentUrl);
    return /^\/i\/bookmarks\/?$/.test(url.pathname);
  } catch {
    return false;
  }
}

export function ensureBookmarksImportControls(): void {
  if (document.body === null) {
    return;
  }

  void refreshOverlayLanguage();

  if (rootElement === null) {
    rootElement = createRootElement();
    document.body.appendChild(rootElement);
  }

  rootElement.hidden = false;
  updateOverlay(currentRun?.stats ?? lastOverlayStats);
}

export function removeBookmarksImportControls(): void {
  if (currentRun !== null) {
    currentRun.stopRequested = true;
    currentRun.stopReason = "left-page";
    currentRun.stats.status = "stopped";
    currentRun.stats.stopReason = "left-page";
    currentRun.stats.message = getOverlayMessage("leftPageSaving");
  }

  overlayExpanded = false;
  rootElement?.remove();
  rootElement = null;
}

function createRootElement(): HTMLDivElement {
  const root = document.createElement("div");
  root.id = ROOT_ID;
  root.style.position = "fixed";
  root.style.right = "20px";
  root.style.bottom = "20px";
  root.style.zIndex = "2147483647";
  root.style.display = "flex";
  root.style.flexDirection = "column";
  root.style.alignItems = "flex-end";
  root.style.gap = "12px";

  const toggleButton = document.createElement("button");
  toggleButton.id = TOGGLE_BUTTON_ID;
  toggleButton.type = "button";
  toggleButton.textContent = getToggleButtonText(false, false);
  toggleButton.style.border = "1px solid #d0d7de";
  toggleButton.style.background = "#ffffff";
  toggleButton.style.color = "#0f1419";
  toggleButton.style.borderRadius = "999px";
  toggleButton.style.padding = "12px 16px";
  toggleButton.style.fontSize = "14px";
  toggleButton.style.fontWeight = "700";
  toggleButton.style.cursor = "pointer";
  toggleButton.style.boxShadow = "0 12px 28px rgba(15, 23, 42, 0.12)";
  toggleButton.addEventListener("click", () => {
    if (currentRun !== null) {
      overlayExpanded = true;
    } else {
      overlayExpanded = !overlayExpanded;
    }

    updateOverlay(
      currentRun?.stats ?? lastOverlayStats
    );
  });

  const overlay = document.createElement("section");
  overlay.id = OVERLAY_ID;
  overlay.hidden = true;
  overlay.style.width = "320px";
  overlay.style.maxWidth = "calc(100vw - 32px)";
  overlay.style.background = "rgba(255, 255, 255, 0.96)";
  overlay.style.color = "#0f172a";
  overlay.style.border = "1px solid rgba(15, 23, 42, 0.1)";
  overlay.style.borderRadius = "20px";
  overlay.style.padding = "16px";
  overlay.style.boxShadow = "0 20px 48px rgba(15, 23, 42, 0.14)";
  overlay.style.backdropFilter = "blur(12px)";
  overlay.innerHTML = [
    `<div data-xpa-overlay-status style="font-size:13px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#2563eb;">${getLocalizedStatusLabel("idle")}</div>`,
    `<div data-xpa-overlay-message style="margin-top:8px;font-size:14px;line-height:1.5;">${getOverlayMessage("ready")}</div>`,
    '<dl style="margin:14px 0 0;display:grid;grid-template-columns:1fr auto;gap:8px 12px;font-size:13px;">',
    `<dt data-xpa-overlay-label-collected style="color:#475569;">${getMetricLabel("collected")}</dt><dd data-xpa-overlay-collected style="margin:0;font-weight:700;">0</dd>`,
    `<dt data-xpa-overlay-label-saved style="color:#475569;">${getMetricLabel("saved")}</dt><dd data-xpa-overlay-saved style="margin:0;font-weight:700;">0</dd>`,
    `<dt data-xpa-overlay-label-duplicates style="color:#475569;">${getMetricLabel("duplicates")}</dt><dd data-xpa-overlay-duplicates style="margin:0;font-weight:700;">0</dd>`,
    `<dt data-xpa-overlay-label-failed style="color:#475569;">${getMetricLabel("failed")}</dt><dd data-xpa-overlay-failed style="margin:0;font-weight:700;">0</dd>`,
    `<dt data-xpa-overlay-label-scanned style="color:#475569;">${getMetricLabel("scanned")}</dt><dd data-xpa-overlay-scanned style="margin:0;font-weight:700;">0</dd>`,
    `<dt data-xpa-overlay-label-waiting style="color:#475569;">${getMetricLabel("waiting")}</dt><dd data-xpa-overlay-waiting style="margin:0;font-weight:700;">0</dd>`,
    "</dl>"
  ].join("");

  const actionButton = document.createElement("button");
  actionButton.id = ACTION_BUTTON_ID;
  actionButton.type = "button";
  actionButton.textContent = getActionButtonText(false);
  actionButton.style.marginTop = "14px";
  actionButton.style.width = "100%";
  actionButton.style.border = "1px solid #cbd5e1";
  actionButton.style.background = "#f8fafc";
  actionButton.style.color = "#0f172a";
  actionButton.style.borderRadius = "999px";
  actionButton.style.padding = "10px 14px";
  actionButton.style.fontSize = "13px";
  actionButton.style.fontWeight = "700";
  actionButton.style.cursor = "pointer";
  actionButton.addEventListener("click", () => {
    if (currentRun === null) {
      overlayExpanded = true;
      void startBookmarksImport();
      return;
    }

    currentRun.stopRequested = true;
    currentRun.stopReason = "manual";
    currentRun.stats.status = "stopping";
    currentRun.stats.stopReason = "manual";
    currentRun.stats.message = getOverlayMessage("stopping");
    updateOverlay(currentRun.stats);
  });
  overlay.appendChild(actionButton);

  root.appendChild(overlay);
  root.appendChild(toggleButton);

  return root;
}

async function startBookmarksImport(): Promise<void> {
  try {
    const [nextLanguage, settings] = await Promise.all([
      loadArchiveLanguage(),
      loadArchiveSettings()
    ]);
    overlayLanguage = nextLanguage;

    if (!isBookmarksTimelinePage()) {
      updateOverlay({
        ...createDefaultOverlayStats(),
        status: "failed",
        message: getOverlayMessage("openBookmarksPage")
      });
      return;
    }

    const run: BookmarksImportRun = {
      stopRequested: false,
      collectingFinished: false,
      stopReason: "none",
      duplicateBatchStreak: 0,
      duplicateBatchThreshold: settings.bulkImportDuplicateBatchThreshold,
      traceId: crypto.randomUUID(),
      inspectPostIds: new Set(await loadDebugInspectPostIds()),
      inspectSignatures: new Map(),
      stats: {
        ...createDefaultOverlayStats(),
        status: "collecting",
        stopReason: "none",
        duplicateBatchStreak: 0,
        duplicateBatchThreshold: settings.bulkImportDuplicateBatchThreshold,
        message: getOverlayMessage("collectingVisiblePosts")
      }
    };
    currentRun = run;
    lastOverlayStats = { ...run.stats };
    overlayExpanded = true;
    updateOverlay(run.stats);
    if (run.inspectPostIds.size > 0) {
      void requestClearLogs().catch(() => {
        // Ignore debug log clear failures.
      });
      void requestDebugLog({
        level: "info",
        event: "bookmarks.import.trace_started",
        traceId: run.traceId,
        context: {
          inspectPostIds: [...run.inspectPostIds]
        }
      }).catch(() => {
        // Ignore debug log failures.
      });
    }

    const collectedPosts = new Map<string, QueuedPostBundle>();
    const saveQueue = new Map<string, QueuedPostBundle>();
    const pendingMediaWaits = new Map<string, PendingMediaWaitState>();
    let noProgressPasses = 0;

    const saveWorker = processSaveQueue(saveQueue, run);

    try {
      for (let scrollStep = 0; scrollStep < MAX_SCROLL_STEPS; scrollStep += 1) {
        if (run.stopRequested) {
          break;
        }

        if (!isBookmarksTimelinePage()) {
          run.stopRequested = true;
          run.stopReason = "left-page";
          run.stats.stopReason = "left-page";
          run.stats.message = getOverlayMessage("leftPageSaving");
          break;
        }

        const beforeCount = collectedPosts.size;
        collectVisiblePosts(collectedPosts, saveQueue, pendingMediaWaits, run.stats, run);
        const addedBeforeScroll = collectedPosts.size - beforeCount;
        const previousScrollHeight = getDocumentScrollHeight();

        if (pendingMediaWaits.size >= MAX_WAITING_POSTS_BEFORE_SCROLL_PAUSE) {
          run.stats.waiting = pendingMediaWaits.size;
          run.stats.status = "collecting";
          run.stats.message = getOverlayMessage("pausingForWaitingPosts", pendingMediaWaits.size);
          updateOverlay(run.stats);
          await wait(WAITING_PAUSE_MS);

          if (run.stopRequested) {
            break;
          }

          collectVisiblePosts(collectedPosts, saveQueue, pendingMediaWaits, run.stats, run);
        } else {
          scrollBookmarksTimeline();
        }

        await wait(getScrollWaitMs(addedBeforeScroll, noProgressPasses));

        if (run.stopRequested) {
          break;
        }

        const beforePostWaitCount = collectedPosts.size;
        collectVisiblePosts(collectedPosts, saveQueue, pendingMediaWaits, run.stats, run);
        const addedAfterScroll = collectedPosts.size - beforePostWaitCount;
        const addedCount = addedBeforeScroll + addedAfterScroll;
        const nextScrollHeight = getDocumentScrollHeight();
        const scrollHeightIncreased = nextScrollHeight > previousScrollHeight;

        run.stats.collected = collectedPosts.size;
        run.stats.waiting = pendingMediaWaits.size;
        run.stats.status = "collecting";
        run.stats.message =
          addedCount > 0
            ? getOverlayMessage("collectedOnPass", addedCount)
            : pendingMediaWaits.size > 0
              ? getOverlayMessage("waitingForMediaHints", pendingMediaWaits.size)
            : scrollHeightIncreased
              ? getOverlayMessage("waitingForRender")
              : getOverlayMessage("noNewPosts");
        updateOverlay(run.stats);

        noProgressPasses =
          addedCount === 0 && !scrollHeightIncreased && pendingMediaWaits.size === 0
            ? noProgressPasses + 1
            : 0;

        if (noProgressPasses >= MAX_IDLE_PASSES) {
          break;
        }
      }

      run.stats.status = run.stopRequested ? "stopping" : "saving";
      run.stats.waiting = pendingMediaWaits.size;
      run.stats.stopReason = run.stopReason;
      run.stats.duplicateBatchStreak = run.duplicateBatchStreak;
      run.stats.duplicateBatchThreshold = run.duplicateBatchThreshold;
      run.stats.message = getSavingStatusMessage(run.stats);
      updateOverlay(run.stats);

      queuePendingMediaWaits(collectedPosts, saveQueue, pendingMediaWaits);
      run.collectingFinished = true;
      await saveWorker;

      if (run.stopRequested) {
        run.stats.status = "stopped";
        run.stats.waiting = pendingMediaWaits.size;
        run.stats.stopReason = run.stopReason;
        run.stats.message = getStoppedStatusMessage(run.stats);
      } else {
        run.stats.status = "completed";
        run.stats.waiting = pendingMediaWaits.size;
        run.stats.stopReason = "none";
        run.stats.message = getOverlayMessage("completed");
      }
    } catch (error) {
      console.error("Bookmarks import failed.", error);
      run.stats.status = "failed";
      run.stats.waiting = pendingMediaWaits.size;
      run.stats.message =
        error instanceof Error && error.message.trim() !== ""
          ? error.message
          : getOverlayMessage("failed");
    } finally {
      overlayExpanded = true;
      updateOverlay(run.stats);
      lastOverlayStats = { ...run.stats };
      currentRun = null;
    }
  } catch (error) {
    if (isExtensionContextInvalidatedError(error)) {
      return;
    }

    throw error;
  }
}

async function processSaveQueue(
  saveQueue: Map<string, QueuedPostBundle>,
  run: BookmarksImportRun
): Promise<void> {
  const language = overlayLanguage;

  while (!run.collectingFinished || saveQueue.size > 0) {
    if (saveQueue.size === 0) {
      await wait(100);
      continue;
    }

    const batch = [...saveQueue.values()].slice(0, SAVE_BATCH_SIZE);

    for (const item of batch) {
      saveQueue.delete(item.post.x_post_id);
    }

    let batchSaved = 0;
    let batchDuplicates = 0;
    let batchFailed = 0;

    try {
      for (const item of batch) {
        const response = await saveQueuedPostBundle(item, language, run.traceId);

        if (response.status === "saved") {
          run.stats.saved += 1;
          batchSaved += 1;
        } else if (response.status === "duplicate") {
          run.stats.duplicates += 1;
          batchDuplicates += 1;
        } else {
          run.stats.failed += 1;
          batchFailed += 1;
        }
      }
    } catch (error) {
      console.error("Bulk bookmark import batch save failed.", {
        postIds: batch.map((item) => item.post.x_post_id),
        error
      });
      run.stats.failed += batch.length;
      batchFailed += batch.length;
    }

    if (batchSaved === 0 && batchFailed === 0 && batchDuplicates > 0) {
      run.duplicateBatchStreak += 1;
    } else {
      run.duplicateBatchStreak = 0;
    }

    run.stats.stopReason = run.stopReason;
    run.stats.duplicateBatchStreak = run.duplicateBatchStreak;
    run.stats.duplicateBatchThreshold = run.duplicateBatchThreshold;

    if (
      !run.stopRequested &&
      run.duplicateBatchStreak >= run.duplicateBatchThreshold
    ) {
      run.stopRequested = true;
      run.stopReason = "duplicate-threshold";
      run.stats.status = "stopping";
      run.stats.stopReason = "duplicate-threshold";
      run.stats.message = getDuplicateThresholdSavingMessage(run.stats);
      run.stats.waiting = saveQueue.size;
      updateOverlay(run.stats);
      continue;
    }

    run.stats.message = formatProcessedProgressMessage(run.stats);
    run.stats.waiting = saveQueue.size;
    updateOverlay(run.stats);
  }
}

function collectVisiblePosts(
  collectedPosts: Map<string, QueuedPostBundle>,
  saveQueue: Map<string, QueuedPostBundle>,
  pendingMediaWaits: Map<string, PendingMediaWaitState>,
  stats: OverlayStats,
  run?: BookmarksImportRun
): void {
  const articles = findTweetArticles();
  stats.scanned += articles.length;

  for (const article of articles) {
    const xPostId = extractPostIdFromArticle(article);
    const extracted = extractPostFromArticle(article);
    const mediaSignals = inspectArticleMediaSignals(article);

    if (extracted === null) {
      emitInspectTrace(run, xPostId, {
        outcome: "post_null",
        imageHintCount: mediaSignals.imageHintCount,
        videoHintCount: mediaSignals.videoHintCount
      });
      continue;
    }

    const bundle = prepareQueuedPostBundle(extracted);
    const post = bundle.post;
    const savableMediaCount = post.media.length + countSavableVideoCandidates(post);
    const mediaHintCount = mediaSignals.imageHintCount + mediaSignals.videoHintCount;
    const shouldWaitForMedia = mediaHintCount > savableMediaCount;
    const waitState = pendingMediaWaits.get(post.x_post_id);

    emitInspectTrace(run, post.x_post_id, {
      outcome: "extracted",
      imageHintCount: mediaSignals.imageHintCount,
      videoHintCount: mediaSignals.videoHintCount,
      mediaCount: post.media.length,
      videoCandidateCount: post.video_candidates?.length ?? 0,
      savableMediaCount,
      shouldWaitForMedia,
      existingWaitPasses: waitState?.waitPasses ?? 0
    });

    const existing = collectedPosts.get(post.x_post_id);
    const nextBundle =
      existing === undefined || isQueuedPostSnapshotRicher(bundle, existing)
        ? bundle
        : existing;

    if (shouldWaitForMedia) {
      const nextWaitState: PendingMediaWaitState = {
        xPostId: post.x_post_id,
        firstSeenAt: waitState?.firstSeenAt ?? Date.now(),
        waitPasses: (waitState?.waitPasses ?? 0) + 1,
        mediaHintCount
      };

      pendingMediaWaits.set(post.x_post_id, nextWaitState);
      emitInspectTrace(run, post.x_post_id, {
        outcome: "waiting_for_media",
        mediaHintCount,
        waitPasses: nextWaitState.waitPasses,
        savableMediaCount
      });

      collectedPosts.set(post.x_post_id, nextBundle);

      if (nextWaitState.waitPasses < MEDIA_WAIT_PASS_LIMIT) {
        continue;
      }

      pendingMediaWaits.delete(post.x_post_id);
      saveQueue.set(post.x_post_id, nextBundle);
      emitInspectTrace(run, post.x_post_id, {
        outcome: "queued",
        mediaCount: nextBundle.post.media.length,
        videoCandidateCount: nextBundle.post.video_candidates?.length ?? 0,
        queueSize: saveQueue.size
      });
      continue;
    }

    pendingMediaWaits.delete(post.x_post_id);

    if (existing !== undefined && nextBundle === existing) {
      emitInspectTrace(run, post.x_post_id, {
        outcome: "skipped_not_richer",
        mediaCount: post.media.length,
        videoCandidateCount: post.video_candidates?.length ?? 0,
        existingMediaCount: existing.post.media.length,
        existingVideoCandidateCount: existing.post.video_candidates?.length ?? 0
      });
      continue;
    }

    collectedPosts.set(post.x_post_id, nextBundle);
    saveQueue.set(post.x_post_id, nextBundle);
    emitInspectTrace(run, post.x_post_id, {
      outcome: "queued",
      mediaCount: nextBundle.post.media.length,
      videoCandidateCount: nextBundle.post.video_candidates?.length ?? 0,
      queueSize: saveQueue.size
    });
  }

  stats.waiting = pendingMediaWaits.size;
}

function queuePendingMediaWaits(
  collectedPosts: Map<string, QueuedPostBundle>,
  saveQueue: Map<string, QueuedPostBundle>,
  pendingMediaWaits: Map<string, PendingMediaWaitState>
): void {
  for (const xPostId of pendingMediaWaits.keys()) {
    const post = collectedPosts.get(xPostId);

    if (post === undefined) {
      continue;
    }

    saveQueue.set(xPostId, post);
  }
}

function emitInspectTrace(
  run: BookmarksImportRun | undefined,
  xPostId: string | null,
  detail: Record<string, unknown>
): void {
  if (run === undefined || xPostId === null || !run.inspectPostIds.has(xPostId)) {
    return;
  }

  const signature = JSON.stringify(detail);
  const previousSignature = run.inspectSignatures.get(xPostId);

  if (previousSignature === signature) {
    return;
  }

  run.inspectSignatures.set(xPostId, signature);
  void requestDebugLog({
    level: "info",
    event: "bookmarks.import.inspect",
    traceId: run.traceId,
    context: {
      xPostId,
      ...detail
    }
  }).catch(() => {
    // Ignore debug log failures during import.
  });
}

function isQueuedPostSnapshotRicher(
  candidate: QueuedPostBundle,
  current: QueuedPostBundle
): boolean {
  const candidateScore = scoreQueuedPostBundle(candidate);
  const currentScore = scoreQueuedPostBundle(current);

  if (candidateScore !== currentScore) {
    return candidateScore > currentScore;
  }

  if (candidate.post.post_text.length !== current.post.post_text.length) {
    return candidate.post.post_text.length > current.post.post_text.length;
  }

  return false;
}

function scoreQueuedPostBundle(bundle: QueuedPostBundle): number {
  return (
    scorePostSnapshot(bundle.post) +
    (bundle.quotedPost === null ? 0 : scorePostSnapshot(bundle.quotedPost) + 25)
  );
}

function scorePostSnapshot(post: SavePostInput): number {
  const imageScore = post.media.reduce((score, media) => {
    let nextScore = score + 10;

    if (media.alt_text !== null) {
      nextScore += 1;
    }

    if (media.width !== null) {
      nextScore += 1;
    }

    if (media.height !== null) {
      nextScore += 1;
    }

    return nextScore;
  }, 0);
  const videoScore = (post.video_candidates ?? []).reduce((score, candidate) => {
    let nextScore = score + 12;

    if (candidate.poster_url !== null || candidate.thumbnail_url !== null) {
      nextScore += 1;
    }

    if (candidate.width !== null) {
      nextScore += 1;
    }

    if (candidate.height !== null) {
      nextScore += 1;
    }

    return nextScore;
  }, 0);

  return imageScore + videoScore;
}

function countSavableVideoCandidates(post: SavePostInput): number {
  return (post.video_candidates ?? []).filter((candidate) => candidate.download_mode === "direct_mp4")
    .length;
}

function prepareQueuedPostBundle(extracted: ExtractedPostBundle): QueuedPostBundle {
  return {
    post: {
      ...extracted.post,
      quoted_post_id: extracted.quotedPost?.x_post_id ?? null
    },
    quotedPost: extracted.quotedPost
  };
}

async function saveQueuedPostBundle(
  item: QueuedPostBundle,
  language: ArchiveLanguage,
  traceId: string
): Promise<{
  status: "saved" | "duplicate" | "failed";
}> {
  const post: SavePostInput = {
    ...item.post,
    auto_tags: buildLocalizedDefaultAutoTags(language, item.post, {
      includeBookmarkedTag: true
    })
  };

  if (item.quotedPost === null) {
    try {
      const response = await requestSavePost(post, {
        traceId
      });

      return {
        status: response.status
      };
    } catch {
      return {
        status: "failed"
      };
    }
  }

  let quotedPostId: string | null = null;

  try {
    const quotedResponse = await requestSavePost(item.quotedPost, {
      traceId
    });

    if (quotedResponse.status === "saved" || quotedResponse.status === "duplicate") {
      quotedPostId = item.quotedPost.x_post_id;
    }
  } catch (error) {
    console.warn("Quoted post save failed during bookmarks import. Saving the main post without linkage.", {
      quotedPostId: item.quotedPost.x_post_id,
      error
    });
  }

  post.quoted_post_id = quotedPostId;

  try {
    const response = await requestSavePost(post, {
      traceId
    });

    return {
      status: response.status
    };
  } catch {
    return {
      status: "failed"
    };
  }
}

function scrollBookmarksTimeline(): void {
  const nextScrollTop = Math.max(
    document.documentElement.scrollHeight,
    document.body?.scrollHeight ?? 0
  );

  window.scrollTo({
    top: nextScrollTop,
    left: 0,
    behavior: "auto"
  });
}

function getDocumentScrollHeight(): number {
  return Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight ?? 0);
}

function getScrollWaitMs(addedCount: number, noProgressPasses: number): number {
  if (addedCount > 0) {
    return MIN_SCROLL_WAIT_MS;
  }

  if (noProgressPasses <= 0) {
    return 350;
  }

  return Math.min(MAX_SCROLL_WAIT_MS, 350 + noProgressPasses * 250);
}

function updateOverlay(stats: OverlayStats): void {
  const root = rootElement;

  lastOverlayStats = { ...stats };

  if (root === null) {
    return;
  }

  const overlay = root.querySelector<HTMLElement>(`#${OVERLAY_ID}`);
  const toggleButton = root.querySelector<HTMLButtonElement>(`#${TOGGLE_BUTTON_ID}`);
  const actionButton = root.querySelector<HTMLButtonElement>(`#${ACTION_BUTTON_ID}`);

  if (overlay === null || toggleButton === null || actionButton === null) {
    return;
  }

  const isRunning =
    stats.status === "collecting" || stats.status === "saving" || stats.status === "stopping";
  const shouldShowOverlay = overlayExpanded || isRunning;

  overlay.hidden = !shouldShowOverlay;
  toggleButton.disabled = false;
  toggleButton.textContent = getToggleButtonText(shouldShowOverlay, isRunning);
  toggleButton.style.opacity = "1";
  actionButton.disabled = stats.status === "stopping";
  actionButton.textContent = getActionButtonText(isRunning);
  actionButton.style.opacity = stats.status === "stopping" ? "0.6" : "1";

  setOverlayText(root, "status", getLocalizedStatusLabel(stats.status));
  setOverlayText(root, "message", stats.message);
  setOverlayText(root, "collected", String(stats.collected));
  setOverlayText(root, "saved", String(stats.saved));
  setOverlayText(root, "duplicates", String(stats.duplicates));
  setOverlayText(root, "failed", String(stats.failed));
  setOverlayText(root, "scanned", String(stats.scanned));
  setOverlayText(root, "waiting", String(stats.waiting));
  setOverlayText(root, "label-collected", getMetricLabel("collected"));
  setOverlayText(root, "label-saved", getMetricLabel("saved"));
  setOverlayText(root, "label-duplicates", getMetricLabel("duplicates"));
  setOverlayText(root, "label-failed", getMetricLabel("failed"));
  setOverlayText(root, "label-scanned", getMetricLabel("scanned"));
  setOverlayText(root, "label-waiting", getMetricLabel("waiting"));
}

async function refreshOverlayLanguage(): Promise<void> {
  try {
    overlayLanguage = await loadArchiveLanguage();
  } catch (error) {
    if (isExtensionContextInvalidatedError(error)) {
      return;
    }

    throw error;
  }

  if (rootElement !== null) {
    if (currentRun === null && lastOverlayStats.status === "idle") {
      lastOverlayStats = createDefaultOverlayStats();
    } else if (currentRun === null) {
      lastOverlayStats = {
        ...lastOverlayStats,
        message: localizeOverlayMessage(lastOverlayStats)
      };
    }

    updateOverlay(currentRun?.stats ?? lastOverlayStats);
  }
}

function isExtensionContextInvalidatedError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("Extension context invalidated");
}

function createDefaultOverlayStats(): OverlayStats {
  return {
    status: "idle",
    collected: 0,
    saved: 0,
    duplicates: 0,
    failed: 0,
    scanned: 0,
    waiting: 0,
    stopReason: "none",
    duplicateBatchStreak: 0,
    duplicateBatchThreshold: DEFAULT_BULK_IMPORT_DUPLICATE_BATCH_THRESHOLD,
    message: getOverlayMessage("ready")
  };
}

function localizeOverlayMessage(stats: OverlayStats): string {
  switch (stats.status) {
    case "idle":
      return getOverlayMessage("ready");
    case "collecting":
      return stats.waiting > 0
        ? getOverlayMessage("waitingForMediaHints", stats.waiting)
        : getOverlayMessage("collectingVisiblePosts");
    case "saving":
      return getSavingStatusMessage(stats);
    case "stopping":
      return getSavingStatusMessage(stats);
    case "stopped":
      return getStoppedStatusMessage(stats);
    case "completed":
      return getOverlayMessage("completed");
    case "failed":
      return stats.message.trim() === "" ? getOverlayMessage("failed") : stats.message;
  }
}

function getSavingStatusMessage(stats: OverlayStats): string {
  switch (stats.stopReason) {
    case "manual":
      return getOverlayMessage("collectionStoppedSaving");
    case "left-page":
      return getOverlayMessage("leftPageSaving");
    case "duplicate-threshold":
      return getDuplicateThresholdSavingMessage(stats);
    case "none":
      return getOverlayMessage("finishingQueuedSaves");
  }
}

function getStoppedStatusMessage(stats: OverlayStats): string {
  switch (stats.stopReason) {
    case "manual":
      return getOverlayMessage("collectionStoppedSaved");
    case "left-page":
      return getLeftPageSavedMessage();
    case "duplicate-threshold":
      return getDuplicateThresholdStoppedMessage(stats);
    case "none":
      return getOverlayMessage("completed");
  }
}

function getDuplicateThresholdSavingMessage(stats: OverlayStats): string {
  if (overlayLanguage === "ja") {
    return `duplicate-only batch が ${stats.duplicateBatchThreshold} 回連続したため収集を停止しました。キュー済みの投稿を保存しています。`;
  }

  return `Stopped collecting after ${stats.duplicateBatchThreshold} duplicate-only batches in a row. Saving queued posts.`;
}

function getDuplicateThresholdStoppedMessage(stats: OverlayStats): string {
  if (overlayLanguage === "ja") {
    return `duplicate-only batch が ${stats.duplicateBatchThreshold} 回連続したため停止しました。キュー済みの投稿は保存されました。`;
  }

  return `Stopped after ${stats.duplicateBatchThreshold} duplicate-only batches in a row. Queued posts were saved.`;
}

function getLeftPageSavedMessage(): string {
  if (overlayLanguage === "ja") {
    return "ブックマークページを離れたため停止しました。キュー済みの投稿は保存されました。";
  }

  return "Stopped because you left the Bookmarks page. Queued posts were saved.";
}

function formatProcessedProgressMessage(stats: OverlayStats): string {
  const processedCount = stats.saved + stats.duplicates + stats.failed;

  if (stats.duplicateBatchStreak <= 0) {
    return getOverlayMessage("processedProgress", processedCount, stats.collected);
  }

  if (overlayLanguage === "ja") {
    return `${processedCount} / ${stats.collected} 件を処理しました。duplicate-only batch 連続 ${stats.duplicateBatchStreak} / ${stats.duplicateBatchThreshold}。`;
  }

  return `Processed ${processedCount} / ${stats.collected} posts. Duplicate-only batch streak: ${stats.duplicateBatchStreak} / ${stats.duplicateBatchThreshold}.`;
}

function getToggleButtonText(isExpanded: boolean, isRunning: boolean): string {
  if (overlayLanguage === "ja") {
    return isExpanded && !isRunning ? "取り込みを隠す" : "ブックマークを取り込む";
  }

  return isExpanded && !isRunning ? "Hide Import" : "Import Bookmarks";
}

function getActionButtonText(isRunning: boolean): string {
  if (overlayLanguage === "ja") {
    return isRunning ? "停止" : "開始";
  }

  return isRunning ? "Stop" : "Start";
}

function getLocalizedStatusLabel(status: OverlayStatus): string {
  if (overlayLanguage === "ja") {
    switch (status) {
      case "idle":
        return "待機中";
      case "collecting":
        return "収集中";
      case "saving":
        return "保存中";
      case "stopping":
        return "停止中";
      case "stopped":
        return "停止済み";
      case "completed":
        return "完了";
      case "failed":
        return "失敗";
    }
  }

  switch (status) {
    case "idle":
      return "Idle";
    case "collecting":
      return "Collecting";
    case "saving":
      return "Saving";
    case "stopping":
      return "Stopping";
    case "stopped":
      return "Stopped";
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
  }
}

function getMetricLabel(
  metric: "collected" | "saved" | "duplicates" | "failed" | "scanned" | "waiting"
): string {
  if (overlayLanguage === "ja") {
    switch (metric) {
      case "collected":
        return "収集";
      case "saved":
        return "保存";
      case "duplicates":
        return "重複";
      case "failed":
        return "失敗";
      case "scanned":
        return "走査";
      case "waiting":
        return "待機";
    }
  }

  switch (metric) {
    case "collected":
      return "Collected";
    case "saved":
      return "Saved";
    case "duplicates":
      return "Duplicates";
    case "failed":
      return "Failed";
    case "scanned":
      return "Scanned";
    case "waiting":
      return "Waiting";
  }
}

function getOverlayMessage(
  key:
    | "ready"
    | "leftPageSaving"
    | "stopping"
    | "openBookmarksPage"
    | "collectingVisiblePosts"
    | "collectedOnPass"
    | "waitingForMediaHints"
    | "pausingForWaitingPosts"
    | "waitingForRender"
    | "noNewPosts"
    | "collectionStoppedSaving"
    | "finishingQueuedSaves"
    | "collectionStoppedSaved"
    | "completed"
    | "failed"
    | "processedProgress",
  ...values: number[]
): string {
  if (overlayLanguage === "ja") {
    switch (key) {
      case "ready":
        return "ブックマーク欄からの取り込みを開始できます。";
      case "leftPageSaving":
        return "ブックマーク欄を離れたため停止しました。キュー済みの投稿を保存しています。";
      case "stopping":
        return "収集を停止しています。集めた投稿は引き続き保存します。";
      case "openBookmarksPage":
        return "取り込みを始める前に X のブックマーク欄を開いてください。";
      case "collectingVisiblePosts":
        return "表示中の投稿を収集中です。";
      case "collectedOnPass":
        return `この周回で ${values[0] ?? 0} 件の新しい投稿を見つけました。`;
      case "waitingForMediaHints":
        return `${values[0] ?? 0} 件の投稿でメディア描画を待っています。`;
      case "pausingForWaitingPosts":
        return `待機中の投稿が ${values[0] ?? 0} 件あるため、スクロールを止めて描画を待っています。`;
      case "waitingForRender":
        return "新しく読み込まれた投稿の描画を待っています。";
      case "noNewPosts":
        return "この周回では新しい投稿は見つかりませんでした。";
      case "collectionStoppedSaving":
        return "収集を止めました。キュー済みの投稿を保存しています。";
      case "finishingQueuedSaves":
        return "残っている保存処理を完了しています。";
      case "collectionStoppedSaved":
        return "収集を停止しました。キュー済みの投稿は保存しました。";
      case "completed":
        return "取り込みが完了しました。";
      case "failed":
        return "ブックマーク欄の取り込みに失敗しました。";
      case "processedProgress":
        return `${values[0] ?? 0} / ${values[1] ?? 0} 件を処理しました。`;
    }
  }

  switch (key) {
    case "ready":
      return "Ready to import from Bookmarks.";
    case "leftPageSaving":
      return "Stopped because you left the Bookmarks page. Saving queued posts.";
    case "stopping":
      return "Stopping collection. Collected posts will still be saved.";
    case "openBookmarksPage":
      return "Open an X Bookmarks page before starting import.";
    case "collectingVisiblePosts":
      return "Collecting visible posts.";
    case "collectedOnPass":
      return `Collected ${values[0] ?? 0} new posts on this pass.`;
    case "waitingForMediaHints":
      return `Waiting for media to render on ${values[0] ?? 0} posts.`;
    case "pausingForWaitingPosts":
      return `Paused scrolling because ${values[0] ?? 0} posts are still waiting for media.`;
    case "waitingForRender":
      return "Waiting for newly loaded posts to render.";
    case "noNewPosts":
      return "No new posts found on this pass.";
    case "collectionStoppedSaving":
      return "Collection stopped. Saving queued posts.";
    case "finishingQueuedSaves":
      return "Finishing queued saves.";
    case "collectionStoppedSaved":
      return "Collection stopped. Queued posts were saved.";
    case "completed":
      return "Import completed.";
    case "failed":
      return "Bookmarks import failed.";
    case "processedProgress":
      return `Processed ${values[0] ?? 0} / ${values[1] ?? 0} posts.`;
  }
}

function setOverlayText(root: HTMLElement, key: string, text: string): void {
  const node = root.querySelector<HTMLElement>(`[data-xpa-overlay-${key}]`);

  if (node !== null) {
    node.textContent = text;
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}
