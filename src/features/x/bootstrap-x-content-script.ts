import type { ContentScriptContext } from "#imports";
import { requestHasPost, requestSavePost } from "../runtime/client";
import {
  buildLocalizedDefaultAutoTags,
  loadArchiveLanguage
} from "../settings/archive-language";
import { extractPostFromArticle, extractPostIdFromArticle } from "./extract-post-from-article";
import { findTweetArticles } from "./find-tweet-articles";
import { ensureGraphqlVideoCandidateListener } from "./graphql-video-candidate-cache";
import { injectSaveButton, setButtonState } from "./inject-save-button";
import {
  ensureLikesImportControls,
  isLikesTimelinePage,
  removeLikesImportControls
} from "./likes-import-controls";

const processedArticles = new WeakSet<HTMLElement>();
let initialized = false;
let scheduled = false;
let bodyObserver: MutationObserver | null = null;
let pendingDomReadyListener: (() => void) | null = null;
let isContentScriptActive = true;

export function bootstrapXContentScript(ctx: ContentScriptContext): void {
  isContentScriptActive = true;
  ctx.onInvalidated(() => {
    isContentScriptActive = false;
    initialized = false;
    scheduled = false;
    bodyObserver?.disconnect();
    bodyObserver = null;
    pendingDomReadyListener?.();
    pendingDomReadyListener = null;
    removeLikesImportControls();
  });
  ensureGraphqlVideoCandidateListener();
  startWhenBodyReady(ctx);
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
    if (!isContentScriptActive) {
      return;
    }

    if (scheduled) {
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
    const extracted = extractPostFromArticle(article);

    if (extracted === null) {
      throw new Error("Post extraction failed.");
    }

    const language = await loadArchiveLanguage();
    const { post, quotedPost } = extracted;

    post.auto_tags = buildLocalizedDefaultAutoTags(language, post, {
      includeLikedTag: isLikesTimelinePage()
    });

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
  });

  const xPostId = extractPostIdFromArticle(article);

  if (xPostId === null) {
    setButtonState(button, "error");
    return;
  }

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

function syncLikesImportControls(): void {
  if (isLikesTimelinePage()) {
    ensureLikesImportControls();
    return;
  }

  removeLikesImportControls();
}

function isExtensionContextInvalidatedError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("Extension context invalidated");
}
