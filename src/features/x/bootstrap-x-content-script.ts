import { requestHasPost, requestSavePost } from "../runtime/client";
import { extractPostFromArticle, extractPostIdFromArticle } from "./extract-post-from-article";
import { findTweetArticles } from "./find-tweet-articles";
import { ensureGraphqlVideoCandidateListener } from "./graphql-video-candidate-cache";
import { injectSaveButton, setButtonState } from "./inject-save-button";

const processedArticles = new WeakSet<HTMLElement>();
let initialized = false;
let scheduled = false;

export function bootstrapXContentScript(): void {
  ensureGraphqlVideoCandidateListener();
  startWhenBodyReady();
}

function startWhenBodyReady(): void {
  if (initialized) {
    return;
  }

  if (document.body === null) {
    document.addEventListener("DOMContentLoaded", startWhenBodyReady, {
      once: true
    });
    return;
  }

  initialized = true;
  scanTweetArticles();
  observeDomChanges();
}

function observeDomChanges(): void {
  if (document.body === null) {
    return;
  }

  const observer = new MutationObserver(() => {
    if (scheduled) {
      return;
    }

    scheduled = true;
    window.requestAnimationFrame(() => {
      scheduled = false;
      scanTweetArticles();
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

function scanTweetArticles(): void {
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
    const post = extractPostFromArticle(article);

    if (post === null) {
      throw new Error("Post extraction failed.");
    }

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
    console.error("Failed to check saved state.", error);
    setButtonState(button, "idle");
  }
}
