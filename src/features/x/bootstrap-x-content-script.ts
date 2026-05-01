import type { ContentScriptContext } from "#imports";
import {
  requestHasPost,
  requestNotifyRefetchComplete,
  requestSavePost,
  requestSaveThread,
  requestSetTweetDetailTemplate
} from "../runtime/client";
import type {
  RefetchCheckMessage,
  RefetchCheckResponse
} from "../../types/refetch";
import {
  buildLocalizedDefaultAutoTags,
  loadArchiveLanguage
} from "../settings/archive-language";
import { loadArchiveSettings } from "../settings/archive-settings";
import { ensureGraphqlEngagementListener } from "./graphql-engagement-cache";
import { ensureGraphqlImageCandidateListener } from "./graphql-image-candidate-cache";
import {
  extractPostFromArticle,
  extractPostIdFromArticle,
  inspectArticleMediaSignals
} from "./extract-post-from-article";
import { findTweetArticles } from "./find-tweet-articles";
import { ensureGraphqlVideoCandidateListener } from "./graphql-video-candidate-cache";
import {
  flashButtonState,
  injectSaveButton,
  setButtonState,
  type SaveButtonState
} from "./inject-save-button";
import {
  ensureBookmarksImportControls,
  isBookmarksTimelinePage,
  removeBookmarksImportControls
} from "./bookmarks-import-controls";
import {
  isLikesTimelinePage,
  ensureLikesImportControls,
  removeLikesImportControls
} from "./likes-import-controls";
import {
  LIKE_BOOKMARK_ACTION_EVENT,
  type LikeBookmarkActionEventDetail
} from "./intercept-like-bookmark-actions";
import { detectThreadPage } from "./detect-thread-page";
import { extractThreadPosts } from "./extract-thread-posts";
import {
  getSaveThreadButton,
  injectSaveThreadButton,
  removeSaveThreadButton,
  setSaveThreadButtonState
} from "./inject-save-thread-button";
import {
  TWEET_DETAIL_TEMPLATE_CAPTURED_EVENT,
  isValidTweetDetailUrl,
  type TweetDetailTemplateCapturedEventDetail
} from "./tweet-detail-template-events";

const SAVE_BUTTON_SELECTOR = "[data-xpa-save-button]";
const AUTO_ARCHIVE_ERROR_DISPLAY_MS = 3000;
const AUTO_ARCHIVE_ARTICLE_RETRY_INTERVAL_MS = 500;
const AUTO_ARCHIVE_ARTICLE_MAX_ATTEMPTS = 10;
const VISIBLE_SAVE_MEDIA_RETRY_INTERVAL_MS = 250;
const VISIBLE_SAVE_MEDIA_MAX_ATTEMPTS = 5;
const QUOTED_POST_CONTAINER_SELECTOR = 'div[role="link"][tabindex="0"]';

const processedArticlePostIds = new WeakMap<HTMLElement, string>();
let initialized = false;
let scheduled = false;
let bodyObserver: MutationObserver | null = null;
let pendingDomReadyListener: (() => void) | null = null;
let isContentScriptActive = true;
let autoArchiveActionListenerInstalled = false;
let refetchMessageListenerInstalled = false;
let tweetDetailTemplateListenerInstalled = false;
const pendingAutoArchiveRetryTimers = new Map<string, number>();
let latestThreadPosts: ReturnType<typeof extractThreadPosts> = [];

export function bootstrapXContentScript(ctx: ContentScriptContext): void {
  isContentScriptActive = true;
  installAutoArchiveActionListener();
  installRefetchMessageListener();
  installTweetDetailTemplateListener();
  ctx.onInvalidated(() => {
    isContentScriptActive = false;
    initialized = false;
    scheduled = false;
    bodyObserver?.disconnect();
    bodyObserver = null;
    pendingDomReadyListener?.();
    pendingDomReadyListener = null;
    clearPendingAutoArchiveRetries();
    removeAutoArchiveActionListener();
    removeRefetchMessageListener();
    removeTweetDetailTemplateListener();
    removeBookmarksImportControls();
    removeLikesImportControls();
    removeSaveThreadButton();
  });
  ensureGraphqlVideoCandidateListener();
  ensureGraphqlImageCandidateListener();
  ensureGraphqlEngagementListener();
  startWhenBodyReady(ctx);
}

function installTweetDetailTemplateListener(): void {
  if (tweetDetailTemplateListenerInstalled) {
    return;
  }

  document.addEventListener(
    TWEET_DETAIL_TEMPLATE_CAPTURED_EVENT,
    handleTweetDetailTemplateCaptured as EventListener
  );
  tweetDetailTemplateListenerInstalled = true;
}

function removeTweetDetailTemplateListener(): void {
  if (!tweetDetailTemplateListenerInstalled) {
    return;
  }

  document.removeEventListener(
    TWEET_DETAIL_TEMPLATE_CAPTURED_EVENT,
    handleTweetDetailTemplateCaptured as EventListener
  );
  tweetDetailTemplateListenerInstalled = false;
}

function handleTweetDetailTemplateCaptured(event: Event): void {
  const detail = (event as CustomEvent<TweetDetailTemplateCapturedEventDetail>).detail;

  if (!isTweetDetailTemplateCapturedEventDetail(detail)) {
    return;
  }

  void requestSetTweetDetailTemplate(detail).catch((error) => {
    if (isExtensionContextInvalidatedError(error)) {
      return;
    }

    console.warn("Failed to save TweetDetail template.", error);
  });
}

function isTweetDetailTemplateCapturedEventDetail(
  value: unknown
): value is TweetDetailTemplateCapturedEventDetail {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<TweetDetailTemplateCapturedEventDetail>;

  return (
    typeof candidate.url === "string" &&
    isValidTweetDetailUrl(candidate.url) &&
    (candidate.method === "GET" || candidate.method === "POST") &&
    isStringRecord(candidate.headers) &&
    isUnknownRecord(candidate.variables) &&
    (candidate.features === null || isUnknownRecord(candidate.features)) &&
    (candidate.fieldToggles === null || isUnknownRecord(candidate.fieldToggles)) &&
    typeof candidate.captured_at === "number" &&
    Number.isFinite(candidate.captured_at)
  );
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    isUnknownRecord(value) &&
    Object.values(value).every((recordValue) => typeof recordValue === "string")
  );
}

function isUnknownRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function installAutoArchiveActionListener(): void {
  if (autoArchiveActionListenerInstalled) {
    return;
  }

  document.addEventListener(
    LIKE_BOOKMARK_ACTION_EVENT,
    handleLikeBookmarkAction as EventListener
  );
  autoArchiveActionListenerInstalled = true;
}

function removeAutoArchiveActionListener(): void {
  if (!autoArchiveActionListenerInstalled) {
    return;
  }

  document.removeEventListener(
    LIKE_BOOKMARK_ACTION_EVENT,
    handleLikeBookmarkAction as EventListener
  );
  autoArchiveActionListenerInstalled = false;
}

function installRefetchMessageListener(): void {
  if (refetchMessageListenerInstalled) {
    return;
  }

  browser.runtime.onMessage.addListener(handleRefetchMessage);
  refetchMessageListenerInstalled = true;
}

function removeRefetchMessageListener(): void {
  if (!refetchMessageListenerInstalled) {
    return;
  }

  browser.runtime.onMessage.removeListener(handleRefetchMessage);
  refetchMessageListenerInstalled = false;
}

function startWhenBodyReady(ctx: ContentScriptContext): void {
  if (!isContentScriptActive || initialized) {
    return;
  }

  if (document.body === null) {
    if (pendingDomReadyListener !== null) {
      return;
    }

    const handleDomReady = () => {
      pendingDomReadyListener = null;
      startWhenBodyReady(ctx);
    };

    document.addEventListener("DOMContentLoaded", handleDomReady, { once: true });
    pendingDomReadyListener = () => {
      document.removeEventListener("DOMContentLoaded", handleDomReady);
    };
    return;
  }

  initialized = true;
  scanTweetArticles();
  observeDomChanges(ctx);
}

function observeDomChanges(ctx: ContentScriptContext): void {
  if (!isContentScriptActive || document.body === null || bodyObserver !== null) {
    return;
  }

  bodyObserver = new MutationObserver(() => {
    if (!isContentScriptActive || scheduled) {
      return;
    }

    scheduled = true;
    ctx.requestAnimationFrame(() => {
      if (!isContentScriptActive) {
        return;
      }

      scheduled = false;
      scanTweetArticles();
    });
  });

  bodyObserver.observe(document.body, {
    childList: true,
    subtree: true
  });
}

function scanTweetArticles(): void {
  syncLikesImportControls();
  syncSaveThreadButton();
  const articles = findTweetArticles();

  for (const article of articles) {
    const xPostId = extractPostIdFromArticle(article);

    if (xPostId === null) {
      continue;
    }

    const existingButton = article.querySelector<HTMLButtonElement>(SAVE_BUTTON_SELECTOR);

    if (processedArticlePostIds.get(article) === xPostId && existingButton !== null) {
      continue;
    }

    processedArticlePostIds.set(article, xPostId);
    void attachSaveButton(article);
  }
}

function syncSaveThreadButton(): void {
  const pageContext = detectThreadPage();

  if (pageContext === null || document.body === null) {
    latestThreadPosts = [];
    removeSaveThreadButton();
    return;
  }

  latestThreadPosts = extractThreadPosts(document, pageContext);
  const button =
    getSaveThreadButton() ??
    injectSaveThreadButton(async () => {
      await saveVisibleThread();
    });

  if (latestThreadPosts.length <= 1) {
    setSaveThreadButtonState(button, "disabled", latestThreadPosts);
    return;
  }

  if (!button.disabled || button.textContent === "連投ではありません") {
    setSaveThreadButtonState(button, "idle", latestThreadPosts);
  }
}

async function saveVisibleThread(): Promise<void> {
  const pageContext = detectThreadPage();

  if (pageContext === null) {
    throw new Error("Thread page context not found.");
  }

  const posts = extractThreadPosts(document, pageContext);

  if (posts.length <= 1) {
    throw new Error("Visible thread has fewer than two OP posts.");
  }

  latestThreadPosts = posts;
  const response = await requestSaveThread(posts);

  if (response.failed > 0) {
    throw new Error("Thread save failed.");
  }
}

async function attachSaveButton(article: HTMLElement): Promise<void> {
  const button = injectSaveButton(article, async () => {
    await saveArticleSnapshot(article, {
      includeLikedTag: isLikesTimelinePage(),
      includeBookmarkedTag: isBookmarksTimelinePage()
    });
  });

  const xPostId = extractPostIdFromArticle(article);

  if (xPostId === null) {
    setButtonState(button, "error");
    return;
  }

  await syncArticleSaveButtonState(button, xPostId);
}

function handleLikeBookmarkAction(event: Event): void {
  const detail = (event as CustomEvent<LikeBookmarkActionEventDetail>).detail;

  if (!isLikeBookmarkActionDetail(detail)) {
    return;
  }

  void autoArchivePost(detail);
}

async function autoArchivePost(detail: LikeBookmarkActionEventDetail): Promise<void> {
  let autoArchiveEnabled = false;

  try {
    const settings = await loadArchiveSettings();
    autoArchiveEnabled =
      detail.action === "like" ? settings.autoArchiveOnLike : settings.autoArchiveOnBookmark;
  } catch (error) {
    console.error("[auto-archive] settings-load-failed", { action: detail.action, xPostId: detail.xPostId, error });
    return;
  }

  if (!autoArchiveEnabled) {
    clearPendingAutoArchiveRetry(detail);
    return;
  }

  await attemptAutoArchive(detail, 0);
}

async function attemptAutoArchive(
  detail: LikeBookmarkActionEventDetail,
  attempt: number
): Promise<void> {
  if (!isContentScriptActive) {
    clearPendingAutoArchiveRetry(detail);
    return;
  }

  scanTweetArticles();
  const article = findArticleByPostId(detail.xPostId);

  if (article === null) {
    if (attempt + 1 < AUTO_ARCHIVE_ARTICLE_MAX_ATTEMPTS) {
      scheduleAutoArchiveRetry(detail, attempt + 1);
      return;
    }

    clearPendingAutoArchiveRetry(detail);
    console.warn("[auto-archive] auto-archive-article-not-found", {
      action: detail.action,
      xPostId: detail.xPostId,
      attempts: attempt + 1
    });
    return;
  }

  clearPendingAutoArchiveRetry(detail);
  const button = article.querySelector<HTMLButtonElement>(SAVE_BUTTON_SELECTOR);

  if (button !== null) {
    setButtonState(button, "saving");
  }

  try {
    await saveArticleSnapshot(article, {
      includeLikedTag: detail.action === "like",
      includeBookmarkedTag: detail.action === "bookmark"
    });

    if (button !== null) {
      setButtonState(button, "saved");
    }
  } catch (error) {
    console.error("[auto-archive] save-failed", { action: detail.action, xPostId: detail.xPostId, error });

    if (button !== null) {
      flashButtonState(
        button,
        "error",
        await resolveCurrentSaveButtonState(detail.xPostId),
        AUTO_ARCHIVE_ERROR_DISPLAY_MS
      );
    }
  }
}

function scheduleAutoArchiveRetry(
  detail: LikeBookmarkActionEventDetail,
  attempt: number
): void {
  const retryKey = getAutoArchiveRetryKey(detail);

  if (pendingAutoArchiveRetryTimers.has(retryKey)) {
    return;
  }

  const timeoutId = window.setTimeout(() => {
    pendingAutoArchiveRetryTimers.delete(retryKey);
    void attemptAutoArchive(detail, attempt);
  }, AUTO_ARCHIVE_ARTICLE_RETRY_INTERVAL_MS);

  pendingAutoArchiveRetryTimers.set(retryKey, timeoutId);
}

async function saveArticleSnapshot(
  article: HTMLElement,
  options: {
    includeLikedTag?: boolean;
    includeBookmarkedTag?: boolean;
  } = {}
): Promise<void> {
  const extracted = await extractReadyPostFromVisibleArticle(article);

  if (extracted === null) {
    throw new Error("Post extraction failed.");
  }

  const language = await loadArchiveLanguage();
  const { post, quotedPost } = extracted;
  const autoTagOptions = {
    ...(options.includeLikedTag === undefined ? {} : { includeLikedTag: options.includeLikedTag }),
    ...(options.includeBookmarkedTag === undefined
      ? {}
      : { includeBookmarkedTag: options.includeBookmarkedTag })
  };

  post.auto_tags = buildLocalizedDefaultAutoTags(language, post, autoTagOptions);

  let quotedPostId: string | null = null;

  if (quotedPost !== null) {
    try {
      const quotedResponse = await requestSavePost(quotedPost);

      if (quotedResponse.status === "saved" || quotedResponse.status === "duplicate") {
        quotedPostId = quotedPost.x_post_id;
      }
    } catch (error) {
      console.warn("Quoted post save failed. Saving the main post without linkage.", error);
    }
  }

  post.quoted_post_id = quotedPostId;
  const response = await requestSavePost(post);

  if (response.status !== "saved" && response.status !== "duplicate") {
    throw new Error("Unexpected save status.");
  }
}

async function extractReadyPostFromVisibleArticle(
  article: HTMLElement
): Promise<ReturnType<typeof extractPostFromArticle>> {
  let latestExtraction = extractPostFromArticle(article);

  for (let attempt = 0; attempt < VISIBLE_SAVE_MEDIA_MAX_ATTEMPTS; attempt += 1) {
    if (!shouldWaitForVisibleArticleMedia(article, latestExtraction)) {
      return latestExtraction;
    }

    await warmupArticleMedia(article);
    await wait(VISIBLE_SAVE_MEDIA_RETRY_INTERVAL_MS);
    latestExtraction = extractPostFromArticle(article);
  }

  return latestExtraction;
}

async function syncArticleSaveButtonState(
  button: HTMLButtonElement,
  xPostId: string
): Promise<void> {
  try {
    const exists = await requestHasPost(xPostId);
    setButtonState(button, exists ? "saved" : "idle");
  } catch (error) {
    if (isExtensionContextInvalidatedError(error)) {
      return;
    }

    console.error("Failed to check saved state.", error);
    setButtonState(button, "idle");
  }
}

async function resolveCurrentSaveButtonState(xPostId: string): Promise<SaveButtonState> {
  try {
    return (await requestHasPost(xPostId)) ? "saved" : "idle";
  } catch {
    return "idle";
  }
}

function findArticleByPostId(xPostId: string): HTMLElement | null {
  for (const article of findTweetArticles()) {
    if (extractPostIdFromArticle(article) === xPostId) {
      return article;
    }
  }

  return null;
}

function getAutoArchiveRetryKey(detail: LikeBookmarkActionEventDetail): string {
  return `${detail.action}:${detail.xPostId}`;
}

function clearPendingAutoArchiveRetry(detail: LikeBookmarkActionEventDetail): void {
  const retryKey = getAutoArchiveRetryKey(detail);
  const timeoutId = pendingAutoArchiveRetryTimers.get(retryKey);

  if (timeoutId !== undefined) {
    window.clearTimeout(timeoutId);
    pendingAutoArchiveRetryTimers.delete(retryKey);
  }
}

function handleRefetchMessage(
  message: unknown,
  _sender: unknown,
  sendResponse: (response?: unknown) => void
): boolean {
  if (!isRefetchCheckMessage(message)) {
    return false;
  }

  void handleRefetchCheck(message)
    .then((response) => {
      sendResponse(response);
    })
    .catch(() => {
      sendResponse(createDefaultRefetchCheckResponse());
    });

  return true;
}

async function handleRefetchCheck(message: RefetchCheckMessage): Promise<RefetchCheckResponse> {
  scanTweetArticles();
  const article = findArticleByPostId(message.xPostId);

  if (article === null) {
    return createDefaultRefetchCheckResponse();
  }

  const extracted = extractPostFromArticle(article);
  const mediaSignals = inspectArticleMediaSignals(article);
  const savableMediaCount =
    extracted === null
      ? 0
      : extracted.post.media.length +
        (extracted.post.video_candidates ?? []).filter((c) => c.download_mode === "direct_mp4")
          .length;
  const mediaHintCount = mediaSignals.imageHintCount + mediaSignals.videoHintCount;
  const waitingForMedia = mediaHintCount > savableMediaCount;
  let warmupApplied = false;

  if (waitingForMedia) {
    warmupApplied = await warmupArticleMedia(article);
    return {
      found: true,
      extracted: extracted !== null,
      waitingForMedia: true,
      imageHintCount: mediaSignals.imageHintCount,
      videoHintCount: mediaSignals.videoHintCount,
      savableMediaCount,
      warmupApplied
    };
  }

  await requestNotifyRefetchComplete(
    message.xPostId,
    extracted?.post ?? null,
    extracted === null ? "Post extraction failed." : null
  );

  return {
    found: true,
    extracted: extracted !== null,
    waitingForMedia: false,
    imageHintCount: mediaSignals.imageHintCount,
    videoHintCount: mediaSignals.videoHintCount,
    savableMediaCount,
    warmupApplied
  };
}

function createDefaultRefetchCheckResponse(): RefetchCheckResponse {
  return {
    found: false,
    extracted: false,
    waitingForMedia: false,
    imageHintCount: 0,
    videoHintCount: 0,
    savableMediaCount: 0,
    warmupApplied: false
  };
}

function shouldWaitForVisibleArticleMedia(
  article: HTMLElement,
  extracted: ReturnType<typeof extractPostFromArticle>
): boolean {
  const mediaSignals = inspectArticleMediaSignals(article);
  const savableMediaCount =
    extracted === null
      ? 0
      : extracted.post.media.length +
        (extracted.post.video_candidates ?? []).filter((c) => c.download_mode === "direct_mp4")
          .length;

  return mediaSignals.imageHintCount + mediaSignals.videoHintCount > savableMediaCount;
}

async function warmupArticleMedia(article: HTMLElement): Promise<boolean> {
  const quotedPostContainer = article.querySelector<HTMLElement>(QUOTED_POST_CONTAINER_SELECTOR);
  const warmupTargets = collectRefetchWarmupTargets(article, quotedPostContainer);
  let warmupApplied = false;

  try {
    article.scrollIntoView({
      block: "center",
      inline: "nearest"
    });
    warmupApplied = true;
  } catch {
    // Ignore browser-specific scroll failures and keep trying other warm-up steps.
  }

  for (const container of warmupTargets.containers) {
    dispatchRefetchWarmupEvents(container);
    warmupApplied = true;
  }

  for (const anchor of warmupTargets.anchors) {
    dispatchRefetchWarmupEvents(anchor);
    warmupApplied = true;
  }

  for (const image of warmupTargets.images) {
    try {
      image.loading = "eager";
      image.decoding = "sync";
    } catch {
      // Ignore property assignment failures.
    }

    const src = image.currentSrc || image.src;

    if (src.trim() !== "" && typeof image.decode === "function") {
      try {
        await image.decode();
        warmupApplied = true;
      } catch {
        warmupApplied = true;
      }
    }
  }

  for (const video of warmupTargets.videos) {
    try {
      video.preload = "auto";
      video.load();
      warmupApplied = true;
    } catch {
      warmupApplied = true;
    }
  }

  return warmupApplied;
}

function collectRefetchWarmupTargets(
  article: HTMLElement,
  quotedPostContainer: HTMLElement | null
): {
  anchors: HTMLAnchorElement[];
  containers: HTMLElement[];
  images: HTMLImageElement[];
  videos: HTMLVideoElement[];
} {
  const anchors = Array.from(article.querySelectorAll<HTMLAnchorElement>('a[href*="/photo/"]')).filter(
    (anchor) => !isNodeInsideQuotedPost(anchor, quotedPostContainer)
  );
  const containers = Array.from(
    article.querySelectorAll<HTMLElement>('[data-testid="tweetPhoto"]')
  ).filter((container) => !isNodeInsideQuotedPost(container, quotedPostContainer));
  const images = Array.from(
    article.querySelectorAll<HTMLImageElement>(
      '[data-testid="tweetPhoto"] img, a[href*="/photo/"] img, img[src*="pbs.twimg.com/media/"]'
    )
  ).filter((image) => !isNodeInsideQuotedPost(image, quotedPostContainer));
  const videos = Array.from(article.querySelectorAll<HTMLVideoElement>("video")).filter(
    (video) => !isNodeInsideQuotedPost(video, quotedPostContainer)
  );

  return {
    anchors,
    containers,
    images,
    videos
  };
}

function dispatchRefetchWarmupEvents(target: Element): void {
  const eventTargets = [
    new PointerEvent("pointerenter", {
      bubbles: true,
      pointerType: "mouse"
    }),
    new MouseEvent("mouseenter", {
      bubbles: true
    }),
    new MouseEvent("mouseover", {
      bubbles: true
    })
  ];

  for (const event of eventTargets) {
    try {
      target.dispatchEvent(event);
    } catch {
      // Ignore synthetic event failures and continue with other warm-up steps.
    }
  }
}

function isNodeInsideQuotedPost(node: Element, quotedPostContainer: HTMLElement | null): boolean {
  return quotedPostContainer !== null && quotedPostContainer.contains(node);
}

function clearPendingAutoArchiveRetries(): void {
  for (const timeoutId of pendingAutoArchiveRetryTimers.values()) {
    window.clearTimeout(timeoutId);
  }

  pendingAutoArchiveRetryTimers.clear();
}

function wait(durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, durationMs);
  });
}

function syncLikesImportControls(): void {
  if (isLikesTimelinePage()) {
    ensureLikesImportControls();
  } else {
    removeLikesImportControls();
  }

  if (isBookmarksTimelinePage()) {
    ensureBookmarksImportControls();
    return;
  }

  removeBookmarksImportControls();
}

function isLikeBookmarkActionDetail(value: unknown): value is LikeBookmarkActionEventDetail {
  return (
    value !== null &&
    typeof value === "object" &&
    (Reflect.get(value, "action") === "like" ||
      Reflect.get(value, "action") === "bookmark") &&
    typeof Reflect.get(value, "xPostId") === "string"
  );
}

function isExtensionContextInvalidatedError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("Extension context invalidated");
}

function isRefetchCheckMessage(value: unknown): value is RefetchCheckMessage {
  return (
    value !== null &&
    typeof value === "object" &&
    Reflect.get(value, "type") === "refetch.check" &&
    typeof Reflect.get(value, "xPostId") === "string"
  );
}
