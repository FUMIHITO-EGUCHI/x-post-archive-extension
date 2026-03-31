import { requestSavePostsBatch } from "../runtime/client";
import { extractPostFromArticle } from "./extract-post-from-article";
import { findTweetArticles } from "./find-tweet-articles";

export const LIKED_AUTO_TAG = "liked";

const ROOT_ID = "xpa-likes-import-root";
const OVERLAY_ID = "xpa-likes-import-overlay";
const TOGGLE_BUTTON_ID = "xpa-likes-import-toggle";
const ACTION_BUTTON_ID = "xpa-likes-import-action";

const MAX_IDLE_PASSES = 6;
const MAX_SCROLL_STEPS = 400;
const MIN_SCROLL_WAIT_MS = 180;
const MAX_SCROLL_WAIT_MS = 900;
const SAVE_BATCH_SIZE = 12;

let rootElement: HTMLDivElement | null = null;
let currentRun: LikesImportRun | null = null;
let overlayExpanded = false;

type OverlayStatus =
  | "idle"
  | "collecting"
  | "saving"
  | "stopping"
  | "stopped"
  | "completed"
  | "failed";

type OverlayStats = {
  status: OverlayStatus;
  collected: number;
  saved: number;
  duplicates: number;
  failed: number;
  scanned: number;
  message: string;
};

type LikesImportRun = {
  stopRequested: boolean;
  collectingFinished: boolean;
  stats: OverlayStats;
};

export function isLikesTimelinePage(currentUrl = window.location.href): boolean {
  try {
    const url = new URL(currentUrl);
    return /^\/[^/]+\/likes\/?$/.test(url.pathname);
  } catch {
    return false;
  }
}

export function ensureLikesImportControls(): void {
  if (document.body === null) {
    return;
  }

  if (rootElement === null) {
    rootElement = createRootElement();
    document.body.appendChild(rootElement);
  }

  rootElement.hidden = false;
  updateOverlay({
    status: currentRun?.stats.status ?? "idle",
    collected: currentRun?.stats.collected ?? 0,
    saved: currentRun?.stats.saved ?? 0,
    duplicates: currentRun?.stats.duplicates ?? 0,
    failed: currentRun?.stats.failed ?? 0,
    scanned: currentRun?.stats.scanned ?? 0,
    message: currentRun?.stats.message ?? "Ready to import from Likes."
  });
}

export function removeLikesImportControls(): void {
  if (currentRun !== null) {
    currentRun.stopRequested = true;
    currentRun.stats.status = "stopped";
    currentRun.stats.message = "Stopped because you left the Likes page. Saving queued posts.";
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
  toggleButton.textContent = "Import Likes";
  toggleButton.style.border = "1px solid #0f1419";
  toggleButton.style.background = "#0f1419";
  toggleButton.style.color = "#ffffff";
  toggleButton.style.borderRadius = "999px";
  toggleButton.style.padding = "12px 16px";
  toggleButton.style.fontSize = "14px";
  toggleButton.style.fontWeight = "700";
  toggleButton.style.cursor = "pointer";
  toggleButton.style.boxShadow = "0 10px 30px rgba(15, 20, 25, 0.24)";
  toggleButton.addEventListener("click", () => {
    if (currentRun !== null) {
      overlayExpanded = true;
    } else {
      overlayExpanded = !overlayExpanded;
    }

    updateOverlay(
      currentRun?.stats ?? {
        status: "idle",
        collected: 0,
        saved: 0,
        duplicates: 0,
        failed: 0,
        scanned: 0,
        message: "Ready to import from Likes."
      }
    );
  });

  const overlay = document.createElement("section");
  overlay.id = OVERLAY_ID;
  overlay.hidden = true;
  overlay.style.width = "320px";
  overlay.style.maxWidth = "calc(100vw - 32px)";
  overlay.style.background = "rgba(15, 20, 25, 0.94)";
  overlay.style.color = "#f7f9f9";
  overlay.style.border = "1px solid rgba(255, 255, 255, 0.12)";
  overlay.style.borderRadius = "20px";
  overlay.style.padding = "16px";
  overlay.style.boxShadow = "0 18px 42px rgba(15, 20, 25, 0.35)";
  overlay.style.backdropFilter = "blur(12px)";
  overlay.innerHTML = [
    '<div data-xpa-overlay-status style="font-size:13px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#8ecdf8;">Idle</div>',
    '<div data-xpa-overlay-message style="margin-top:8px;font-size:14px;line-height:1.5;">Ready to import from Likes.</div>',
    '<dl style="margin:14px 0 0;display:grid;grid-template-columns:1fr auto;gap:8px 12px;font-size:13px;">',
    '<dt style="color:#9fb0c0;">Collected</dt><dd data-xpa-overlay-collected style="margin:0;font-weight:700;">0</dd>',
    '<dt style="color:#9fb0c0;">Saved</dt><dd data-xpa-overlay-saved style="margin:0;font-weight:700;">0</dd>',
    '<dt style="color:#9fb0c0;">Duplicates</dt><dd data-xpa-overlay-duplicates style="margin:0;font-weight:700;">0</dd>',
    '<dt style="color:#9fb0c0;">Failed</dt><dd data-xpa-overlay-failed style="margin:0;font-weight:700;">0</dd>',
    '<dt style="color:#9fb0c0;">Scanned</dt><dd data-xpa-overlay-scanned style="margin:0;font-weight:700;">0</dd>',
    "</dl>"
  ].join("");

  const actionButton = document.createElement("button");
  actionButton.id = ACTION_BUTTON_ID;
  actionButton.type = "button";
  actionButton.textContent = "Start";
  actionButton.style.marginTop = "14px";
  actionButton.style.width = "100%";
  actionButton.style.border = "1px solid rgba(255, 255, 255, 0.2)";
  actionButton.style.background = "rgba(255, 255, 255, 0.08)";
  actionButton.style.color = "#f7f9f9";
  actionButton.style.borderRadius = "999px";
  actionButton.style.padding = "10px 14px";
  actionButton.style.fontSize = "13px";
  actionButton.style.fontWeight = "700";
  actionButton.style.cursor = "pointer";
  actionButton.addEventListener("click", () => {
    if (currentRun === null) {
      overlayExpanded = true;
      void startLikesImport();
      return;
    }

    currentRun.stopRequested = true;
    currentRun.stats.status = "stopping";
    currentRun.stats.message = "Stopping collection. Collected posts will still be saved.";
    updateOverlay(currentRun.stats);
  });
  overlay.appendChild(actionButton);

  root.appendChild(overlay);
  root.appendChild(toggleButton);

  return root;
}

async function startLikesImport(): Promise<void> {
  if (!isLikesTimelinePage()) {
    updateOverlay({
      status: "failed",
      collected: 0,
      saved: 0,
      duplicates: 0,
      failed: 0,
      scanned: 0,
      message: "Open an X Likes page before starting import."
    });
    return;
  }

  const run: LikesImportRun = {
    stopRequested: false,
    collectingFinished: false,
    stats: {
      status: "collecting",
      collected: 0,
      saved: 0,
      duplicates: 0,
      failed: 0,
      scanned: 0,
      message: "Collecting visible posts."
    }
  };
  currentRun = run;
  overlayExpanded = true;
  updateOverlay(run.stats);

  const collectedPosts = new Map<string, NonNullable<ReturnType<typeof extractPostFromArticle>>>();
  const saveQueue: Array<NonNullable<ReturnType<typeof extractPostFromArticle>>> = [];
  let noProgressPasses = 0;

  const saveWorker = processSaveQueue(saveQueue, run);

  try {
    for (let scrollStep = 0; scrollStep < MAX_SCROLL_STEPS; scrollStep += 1) {
      if (run.stopRequested) {
        break;
      }

      if (!isLikesTimelinePage()) {
        run.stopRequested = true;
        run.stats.message = "Stopped because you left the Likes page. Saving queued posts.";
        break;
      }

      const beforeCount = collectedPosts.size;
      collectVisiblePosts(collectedPosts, saveQueue, run.stats);
      const addedBeforeScroll = collectedPosts.size - beforeCount;
      const previousScrollHeight = getDocumentScrollHeight();

      scrollLikesTimeline();
      await wait(getScrollWaitMs(addedBeforeScroll, noProgressPasses));

      const beforePostWaitCount = collectedPosts.size;
      collectVisiblePosts(collectedPosts, saveQueue, run.stats);
      const addedAfterScroll = collectedPosts.size - beforePostWaitCount;
      const addedCount = addedBeforeScroll + addedAfterScroll;
      const nextScrollHeight = getDocumentScrollHeight();
      const scrollHeightIncreased = nextScrollHeight > previousScrollHeight;

      run.stats.collected = collectedPosts.size;
      run.stats.status = "collecting";
      run.stats.message =
        addedCount > 0
          ? `Collected ${addedCount} new posts on this pass.`
          : scrollHeightIncreased
            ? "Waiting for newly loaded posts to render."
            : "No new posts found on this pass.";
      updateOverlay(run.stats);

      noProgressPasses = addedCount === 0 && !scrollHeightIncreased ? noProgressPasses + 1 : 0;

      if (noProgressPasses >= MAX_IDLE_PASSES) {
        break;
      }
    }

    run.stats.status = run.stopRequested ? "stopping" : "saving";
    run.stats.message = run.stopRequested
      ? "Collection stopped. Saving queued posts."
      : "Finishing queued saves.";
    updateOverlay(run.stats);

    run.collectingFinished = true;
    await saveWorker;

    if (run.stopRequested) {
      run.stats.status = "stopped";
      run.stats.message = "Collection stopped. Queued posts were saved.";
    } else {
      run.stats.status = "completed";
      run.stats.message = "Import completed.";
    }
  } catch (error) {
    console.error("Likes import failed.", error);
    run.stats.status = "failed";
    run.stats.message = error instanceof Error ? error.message : "Likes import failed.";
  } finally {
    overlayExpanded = true;
    updateOverlay(run.stats);
    currentRun = null;
  }
}

async function processSaveQueue(
  saveQueue: Array<NonNullable<ReturnType<typeof extractPostFromArticle>>>,
  run: LikesImportRun
): Promise<void> {
  while (!run.collectingFinished || saveQueue.length > 0) {
    if (saveQueue.length === 0) {
      await wait(100);
      continue;
    }

    const batch = saveQueue.splice(0, SAVE_BATCH_SIZE);

    try {
      const response = await requestSavePostsBatch(
        batch.map((post) => ({
          ...post,
          auto_tags: [LIKED_AUTO_TAG]
        }))
      );

      run.stats.saved += response.saved;
      run.stats.duplicates += response.duplicates;
      run.stats.failed += response.failed;
    } catch (error) {
      console.error("Bulk like import batch save failed.", {
        postIds: batch.map((post) => post.x_post_id),
        error
      });
      run.stats.failed += batch.length;
    }

    run.stats.message = `Processed ${run.stats.saved + run.stats.duplicates + run.stats.failed} / ${run.stats.collected} posts.`;
    updateOverlay(run.stats);
  }
}

function collectVisiblePosts(
  collectedPosts: Map<string, NonNullable<ReturnType<typeof extractPostFromArticle>>>,
  saveQueue: Array<NonNullable<ReturnType<typeof extractPostFromArticle>>>,
  stats: OverlayStats
): void {
  const articles = findTweetArticles();
  stats.scanned += articles.length;

  for (const article of articles) {
    const post = extractPostFromArticle(article);

    if (post === null || collectedPosts.has(post.x_post_id)) {
      continue;
    }

    collectedPosts.set(post.x_post_id, post);
    saveQueue.push(post);
  }
}

function scrollLikesTimeline(): void {
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
  toggleButton.textContent = shouldShowOverlay && !isRunning ? "Hide Import" : "Import Likes";
  toggleButton.style.opacity = "1";
  actionButton.disabled = stats.status === "stopping";
  actionButton.textContent = isRunning ? "Stop" : "Start";
  actionButton.style.opacity = stats.status === "stopping" ? "0.6" : "1";

  setOverlayText(root, "status", stats.status);
  setOverlayText(root, "message", stats.message);
  setOverlayText(root, "collected", String(stats.collected));
  setOverlayText(root, "saved", String(stats.saved));
  setOverlayText(root, "duplicates", String(stats.duplicates));
  setOverlayText(root, "failed", String(stats.failed));
  setOverlayText(root, "scanned", String(stats.scanned));
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
