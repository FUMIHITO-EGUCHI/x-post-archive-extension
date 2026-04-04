import type { ContentScriptContext } from "#imports";
import { requestHasPost, requestSavePost } from "../runtime/client";
import {
  buildLocalizedDefaultAutoTags,
  loadArchiveLanguage
} from "../settings/archive-language";
import { loadArchiveSettings } from "../settings/archive-settings";
import { extractPostFromArticle, extractPostIdFromArticle } from "./extract-post-from-article";
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

const SAVE_BUTTON_SELECTOR = "[data-xpa-save-button]";
const AUTO_ARCHIVE_ERROR_DISPLAY_MS = 3000;

const processedArticles = new WeakSet<HTMLElement>();
let initialized = false;
let scheduled = false;
let bodyObserver: MutationObserver | null = null;
let pendingDomReadyListener: (() => void) | null = null;
let isContentScriptActive = true;
let autoArchiveActionListenerInstalled = false;

export function bootstrapXContentScript(ctx: ContentScriptContext): void {
  isContentScriptActive = true;
  installAutoArchiveActionListener();
  ctx.onInvalidated(() => {
    isContentScriptActive = false;
    initialized = false;
    scheduled = false;
    bodyObserver?.disconnect();
    bodyObserver = null;
    pendingDomReadyListener?.();
    pendingDomReadyListener = null;
    removeAutoArchiveActionListener();
    removeBookmarksImportControls();
    removeLikesImportControls();
  });
  ensureGraphqlVideoCandidateListener();
  startWhenBodyReady(ctx);
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
  const articles = findTweetArticles();

  for (const article of articles) {
    if (processedArticles.has(article)) {
      continue;
    }

    processedArticles.add(article);
    void attachSaveButton(article);
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
    return;
  }

  scanTweetArticles();
  const article = findArticleByPostId(detail.xPostId);

  if (article === null) {
    console.warn("[auto-archive] auto-archive-article-not-found", { action: detail.action, xPostId: detail.xPostId });
    return;
  }

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

async function saveArticleSnapshot(
  article: HTMLElement,
  options: {
    includeLikedTag?: boolean;
    includeBookmarkedTag?: boolean;
  } = {}
): Promise<void> {
  const extracted = extractPostFromArticle(article);

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
