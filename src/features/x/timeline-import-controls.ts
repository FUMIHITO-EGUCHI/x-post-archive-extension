import { createUiIcon } from "./ui-icons";
import { onXUiLanguageChange, xUiStrings } from "./x-ui-strings";
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

export type TimelineImportControlsConfig = {
  pageKind: "likes" | "bookmarks";
  rootId: string;
  overlayId: string;
  toggleButtonId: string;
  actionButtonId: string;
  traceEventPrefix: string;
  isTimelinePage: (currentUrl: string) => boolean;
  autoTagOptions: {
    includeLikedTag?: boolean;
    includeBookmarkedTag?: boolean;
  };
};

export type TimelineImportControls = {
  isTimelinePage: (currentUrl?: string) => boolean;
  ensureImportControls: () => void;
  removeImportControls: () => void;
};

export function createTimelineImportControls(config: TimelineImportControlsConfig): TimelineImportControls {
const ROOT_ID = config.rootId;
const OVERLAY_ID = config.overlayId;
const TOGGLE_BUTTON_ID = config.toggleButtonId;
const ACTION_BUTTON_ID = config.actionButtonId;

const MAX_IDLE_PASSES = 6;
const MAX_SCROLL_STEPS = 400;
const MIN_SCROLL_WAIT_MS = 180;
const MAX_SCROLL_WAIT_MS = 900;
const SAVE_BATCH_SIZE = 12;
const MEDIA_WAIT_PASS_LIMIT = 4;
const MAX_WAITING_POSTS_BEFORE_SCROLL_PAUSE = 6;
const WAITING_PAUSE_MS = 700;
const FINAL_STOP_SCROLL_COLLECT_PASSES = 6;
const FINAL_STOP_SCROLL_COLLECT_WAIT_MS = 500;
const TIMELINE_SCROLL_VIEWPORT_RATIO = 0.85;
const MIN_TIMELINE_SCROLL_STEP_PX = 550;
const MAX_TIMELINE_SCROLL_STEP_PX = 1000;

let rootElement: HTMLDivElement | null = null;
let currentRun: ImportRun | null = null;
let overlayExpanded = false;
let needsTargetPage = false;
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
};

type ImportRun = {
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

function isTimelinePage(currentUrl = window.location.href): boolean {
  return config.isTimelinePage(currentUrl);
}

function ensureImportControls(): void {
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

function removeImportControls(): void {
  if (currentRun !== null) {
    currentRun.stopRequested = true;
    currentRun.stopReason = "left-page";
    currentRun.stats.status = "stopped";
    currentRun.stats.stopReason = "left-page";

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
  const status = document.createElement("div");
  Object.assign(status.style, {
    display: "inline-block",
    borderRadius: "999px",
    padding: "4px 9px",
    fontSize: "13px",
    fontWeight: "700"
  });
  const dot = document.createElement("span");
  dot.dataset.xpaOverlayDot = "";
  Object.assign(dot.style, {
    display: "none",
    width: "7px",
    height: "7px",
    borderRadius: "50%",
    background: "currentColor",
    marginRight: "6px"
  });
  if (typeof dot.animate === "function" && !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
    dot.animate([{ opacity: 1 }, { opacity: 0.25 }, { opacity: 1 }], { duration: 1200, iterations: Infinity });
  }
  const statusLabel = document.createElement("span");
  statusLabel.dataset.xpaOverlayStatus = "";
  status.append(dot, statusLabel);
  overlay.append(status);
  const message = document.createElement("div");
  message.dataset.xpaOverlayMessage = "";
  Object.assign(message.style, {
    marginTop: "8px",
    fontSize: "13px"
  });
  overlay.append(message);
  const progress = document.createElement("progress");
  progress.dataset.xpaOverlayProgress = "";
  progress.max = 1;
  Object.assign(progress.style, {
    width: "100%",
    marginTop: "12px",
    accentColor: "#1d9bf0"
  });
  overlay.append(progress);
  const metrics = document.createElement("div");
  Object.assign(metrics.style, {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
    marginTop: "10px",
    fontSize: "12px"
  });
  for (const key of ["collected", "saved", "duplicates", "failed", "scanned", "waiting"]) {
    const chip = document.createElement("span");
    Object.assign(chip.style, {
      background: "#f1f5f9",
      borderRadius: "999px",
      padding: "4px 7px"
    });
    const label = document.createElement("span");
    label.setAttribute(`data-xpa-overlay-label-${key}`, "");
    const value = document.createElement("strong");
    value.setAttribute(`data-xpa-overlay-${key}`, "");
    chip.append(label, document.createTextNode(" "), value);
    metrics.append(chip);
  }
  const streak = document.createElement("span");
  streak.dataset.xpaOverlayStreak = "";
  Object.assign(streak.style, {
    background: "#fff7ed",
    borderRadius: "999px",
    padding: "4px 7px"
  });
  const streakIcon = createUiIcon("Pause");
  streakIcon.setAttribute("width", "14");
  streakIcon.setAttribute("height", "14");
  streak.append(streakIcon, document.createTextNode(""));
  metrics.append(streak);
  overlay.append(metrics);

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
      void startImport();
      return;
    }

    currentRun.stopRequested = true;
    currentRun.stopReason = "manual";
    currentRun.stats.status = "stopping";
    currentRun.stats.stopReason = "manual";

    updateOverlay(currentRun.stats);
  });
  overlay.appendChild(actionButton);

  root.appendChild(overlay);
  root.appendChild(toggleButton);

  return root;
}

async function startImport(): Promise<void> {
  try {
    needsTargetPage = false;
    const [nextLanguage, settings] = await Promise.all([
      loadArchiveLanguage(),
      loadArchiveSettings()
    ]);
    overlayLanguage = nextLanguage;

    if (!isTimelinePage()) {
      needsTargetPage = true;
      updateOverlay({
        ...createDefaultOverlayStats(),
        status: "failed"
      });
      return;
    }

    const run: ImportRun = {
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
        duplicateBatchThreshold: settings.bulkImportDuplicateBatchThreshold
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
        event: `${config.traceEventPrefix}.trace_started`,
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

        if (!isTimelinePage()) {
          run.stopRequested = true;
          run.stopReason = "left-page";
          run.stats.stopReason = "left-page";

          break;
        }

        const beforeCount = collectedPosts.size;
        collectVisiblePosts(collectedPosts, saveQueue, pendingMediaWaits, run.stats, run);
        const addedBeforeScroll = collectedPosts.size - beforeCount;
        const previousScrollHeight = getDocumentScrollHeight();
        let scrolledThisPass = false;

        if (pendingMediaWaits.size >= MAX_WAITING_POSTS_BEFORE_SCROLL_PAUSE) {
          run.stats.waiting = pendingMediaWaits.size;
          run.stats.status = "collecting";

          updateOverlay(run.stats);
          await wait(WAITING_PAUSE_MS);

          if (run.stopRequested) {
            break;
          }

          collectVisiblePosts(collectedPosts, saveQueue, pendingMediaWaits, run.stats, run);
        } else {
          scrollTimeline();
          scrolledThisPass = true;
        }

        await wait(getScrollWaitMs(addedBeforeScroll, noProgressPasses));

        if (run.stopRequested) {
          if (scrolledThisPass && isTimelinePage()) {
            await collectFinalScrolledPosts(collectedPosts, saveQueue, pendingMediaWaits, run.stats, run);
          }
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

      updateOverlay(run.stats);

      queuePendingMediaWaits(collectedPosts, saveQueue, pendingMediaWaits);
      run.collectingFinished = true;
      await saveWorker;

      if (run.stopRequested) {
        run.stats.status = "stopped";
        run.stats.waiting = pendingMediaWaits.size;
        run.stats.stopReason = run.stopReason;

      } else {
        run.stats.status = "completed";
        run.stats.waiting = pendingMediaWaits.size;
        run.stats.stopReason = "none";

      }
    } catch (error) {
      console.error(`${config.traceEventPrefix} failed.`, error);
      run.stats.status = "failed";
      run.stats.waiting = pendingMediaWaits.size;

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
  run: ImportRun
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
      console.error(`${config.traceEventPrefix} batch save failed.`, {
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

      run.stats.waiting = saveQueue.size;
      updateOverlay(run.stats);
      continue;
    }

    run.stats.waiting = saveQueue.size;
    updateOverlay(run.stats);
  }
}

function collectVisiblePosts(
  collectedPosts: Map<string, QueuedPostBundle>,
  saveQueue: Map<string, QueuedPostBundle>,
  pendingMediaWaits: Map<string, PendingMediaWaitState>,
  stats: OverlayStats,
  run?: ImportRun
): void {
  const articles = findTweetArticles();
  stats.scanned += articles.length;

  for (const article of articles) {
    const xPostId = extractPostIdFromArticle(article);
    const mediaSignals = inspectArticleMediaSignals(article);
    let extracted: ExtractedPostBundle | null;

    try {
      extracted = extractPostFromArticle(article);
    } catch (error) {
      console.warn(`${config.traceEventPrefix} extraction failed; skipping article.`, {
        xPostId,
        error
      });
      emitInspectTrace(run, xPostId, {
        outcome: "post_null",
        imageHintCount: mediaSignals.imageHintCount,
        videoHintCount: mediaSignals.videoHintCount
      });
      continue;
    }

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

async function collectFinalScrolledPosts(
  collectedPosts: Map<string, QueuedPostBundle>,
  saveQueue: Map<string, QueuedPostBundle>,
  pendingMediaWaits: Map<string, PendingMediaWaitState>,
  stats: OverlayStats,
  run: ImportRun
): Promise<void> {
  for (let pass = 0; pass < FINAL_STOP_SCROLL_COLLECT_PASSES; pass += 1) {
    collectVisiblePosts(collectedPosts, saveQueue, pendingMediaWaits, stats, run);

    if (pass < FINAL_STOP_SCROLL_COLLECT_PASSES - 1) {
      await wait(FINAL_STOP_SCROLL_COLLECT_WAIT_MS);
    }
  }
}

function emitInspectTrace(
  run: ImportRun | undefined,
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
    event: `${config.traceEventPrefix}.inspect`,
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
      ...config.autoTagOptions
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
    console.warn(`${config.traceEventPrefix} quoted post save failed. Saving the main post without linkage.`, {
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

function scrollTimeline(): void {
  const viewportStep = Math.floor(window.innerHeight * TIMELINE_SCROLL_VIEWPORT_RATIO);
  const nextScrollTop =
    window.scrollY +
    Math.min(MAX_TIMELINE_SCROLL_STEP_PX, Math.max(MIN_TIMELINE_SCROLL_STEP_PX, viewportStep));

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
  const toggleText = getToggleButtonText(shouldShowOverlay, isRunning);
  if (toggleButton.textContent !== toggleText) toggleButton.textContent = toggleText;
  toggleButton.style.opacity = "1";
  actionButton.disabled = stats.status === "stopping";
  const actionText = getActionButtonText(isRunning);
  if (actionButton.textContent !== actionText) actionButton.textContent = actionText;
  actionButton.style.opacity = stats.status === "stopping" ? "0.6" : "1";

  setOverlayText(root, "status", getLocalizedStatusLabel(stats.status));
  const ui = xUiStrings();
  const visibleMessage =
    stats.stopReason === "manual" ? ui.manual
      : stats.stopReason === "left-page" ? ui.left
        : stats.stopReason === "duplicate-threshold" ? ui.duplicate
          : stats.status === "failed"
            ? needsTargetPage ? ui.open(config.pageKind === "likes" ? ui.likes : ui.bookmarks) : ui.failure
            : "";
  setOverlayText(root, "message", visibleMessage);
  const statusNode = root.querySelector<HTMLElement>("[data-xpa-overlay-status]");
  if (statusNode?.parentElement) {
    const color =
      stats.status === "failed" ? "#b91c1c"
        : stats.status === "completed" ? "#15803d"
          : stats.status === "stopping" || stats.status === "stopped" ? "#b45309"
            : isRunning ? "#1d4ed8" : "#475569";
    statusNode.parentElement.style.color = color;
    statusNode.parentElement.style.background = `${color}18`;
  }
  const dot = root.querySelector<HTMLElement>("[data-xpa-overlay-dot]");
  if (dot !== null) {
    dot.style.display = stats.status === "collecting" || stats.status === "saving" ? "inline-block" : "none";
  }
  const progress = root.querySelector<HTMLProgressElement>("[data-xpa-overlay-progress]");
  if (progress !== null) {
    progress.max = Math.max(1, stats.collected);
    progress.value = Math.min(progress.max, stats.saved + stats.duplicates + stats.failed);
    progress.setAttribute("aria-label", ui.progress);
    progress.title = ui.progress;
  }
  const streak = root.querySelector<HTMLElement>("[data-xpa-overlay-streak]");
  if (streak !== null) {
    const value = ` ${stats.duplicateBatchStreak}/${stats.duplicateBatchThreshold}`;
    if (streak.lastChild?.textContent !== value && streak.lastChild !== null) {
      streak.lastChild.textContent = value;
    }
    streak.title = ui.streak;
  }
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
    duplicateBatchThreshold: DEFAULT_BULK_IMPORT_DUPLICATE_BATCH_THRESHOLD
  };
}

function getToggleButtonText(isExpanded: boolean, isRunning: boolean): string {
  const ui = xUiStrings();
  return isExpanded && !isRunning
    ? ui.hide
    : ui.import(config.pageKind === "likes" ? ui.likes : ui.bookmarks);
}
function getActionButtonText(isRunning: boolean): string {
  return isRunning ? xUiStrings().stop : xUiStrings().start;
}
function getLocalizedStatusLabel(status: OverlayStatus): string {
  return xUiStrings().status[status];
}
function getMetricLabel(metric: "collected" | "saved" | "duplicates" | "failed" | "scanned" | "waiting"): string {
  return xUiStrings().metric[metric];
}
function setOverlayText(root: HTMLElement, key: string, text: string): void {
  const node = root.querySelector<HTMLElement>(`[data-xpa-overlay-${key}]`);

  if (node !== null && node.textContent !== text) {
    node.textContent = text;
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}


onXUiLanguageChange(() => updateOverlay(currentRun?.stats ?? lastOverlayStats));

return {
  isTimelinePage,
  ensureImportControls,
  removeImportControls
};
}
