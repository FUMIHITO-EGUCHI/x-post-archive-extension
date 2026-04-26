/**
 * Main world utility: reads React Fiber from quoted post containers and annotates
 * them with `data-xpa-quoted-permalink` so the isolated-world content script can
 * extract the permalink without needing access to the fiber tree.
 *
 * Must be called from the MAIN world content script because isolated world
 * content scripts cannot enumerate `__reactFiber$*` properties on DOM elements.
 */

const QUOTED_CONTAINER_SELECTOR = 'div[role="link"][tabindex="0"]';
const ANNOTATION_ATTR = "data-xpa-quoted-permalink";
const IN_REPLY_TO_POST_ID_ATTR = "data-xpa-in-reply-to-post-id";
const ARTICLE_SELECTOR = 'article[data-testid="tweet"]';
let annotatorInstalled = false;
let annotatorInstallPending = false;

export function annotateQuotedPostContainers(): void {
  const articles = document.querySelectorAll<HTMLElement>(ARTICLE_SELECTOR);

  for (const article of articles) {
    annotateArticleReplyTarget(article);

    for (const container of article.querySelectorAll<HTMLElement>(QUOTED_CONTAINER_SELECTOR)) {
      if (container.hasAttribute(ANNOTATION_ATTR)) {
        continue;
      }

      const permalink = extractPermalinkFromFiber(container);

      if (permalink !== null) {
        container.setAttribute(ANNOTATION_ATTR, permalink);
      }
    }
  }
}

export function installQuotedPostContainerAnnotator(): void {
  if (annotatorInstalled || annotatorInstallPending) {
    return;
  }

  if (document.body !== null) {
    setupAnnotator();
    return;
  }

  annotatorInstallPending = true;
  document.addEventListener(
    "DOMContentLoaded",
    () => {
      annotatorInstallPending = false;
      setupAnnotator();
    },
    { once: true }
  );
}

function setupAnnotator(): void {
  if (annotatorInstalled || document.body === null) {
    return;
  }

  annotatorInstalled = true;
  annotateQuotedPostContainers();

  const observer = new MutationObserver(() => {
    annotateQuotedPostContainers();
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

function annotateArticleReplyTarget(article: HTMLElement): void {
  const inReplyToPostId = extractInReplyToPostIdFromFiber(article);

  if (inReplyToPostId === null) {
    article.removeAttribute(IN_REPLY_TO_POST_ID_ATTR);
    return;
  }

  article.setAttribute(IN_REPLY_TO_POST_ID_ATTR, inReplyToPostId);
}

function extractPermalinkFromFiber(element: HTMLElement): string | null {
  const fromTweet = extractTweetValueFromFiber(element, (tweet) => {
    const permalink = Reflect.get(tweet, "permalink");

    if (typeof permalink === "string") {
      return permalink;
    }

    return null;
  });

  if (fromTweet !== null) {
    return fromTweet;
  }

  return extractLinkPathnameFromFiber(element);
}

function extractInReplyToPostIdFromFiber(root: HTMLElement): string | null {
  for (const element of iterateFiberCandidates(root)) {
    const inReplyToPostId = extractTweetValueFromFiber(element, (tweet) => {
      const direct = Reflect.get(tweet, "in_reply_to_status_id_str");

      if (typeof direct === "string" && direct.trim() !== "") {
        return direct;
      }

      const legacy = Reflect.get(tweet, "legacy");

      if (legacy !== null && typeof legacy === "object") {
        const legacyValue = Reflect.get(legacy, "in_reply_to_status_id_str");

        if (typeof legacyValue === "string" && legacyValue.trim() !== "") {
          return legacyValue;
        }
      }

      return null;
    });

    if (inReplyToPostId !== null) {
      return inReplyToPostId;
    }
  }

  return null;
}

function* iterateFiberCandidates(root: HTMLElement): Generator<HTMLElement> {
  yield root;

  for (const element of root.querySelectorAll<HTMLElement>("*")) {
    yield element;
  }
}

function extractTweetValueFromFiber<T>(
  element: HTMLElement,
  readValue: (tweet: object) => T | null
): T | null {
  const fiberKey = Object.keys(element).find((key) => key.startsWith("__reactFiber"));

  if (fiberKey === undefined) {
    return null;
  }

  let fiber: unknown = Reflect.get(element, fiberKey);

  for (let depth = 0; depth < 30; depth += 1) {
    if (fiber === null || typeof fiber !== "object") {
      break;
    }

    const memoizedProps: unknown = Reflect.get(fiber as object, "memoizedProps");

    if (memoizedProps !== null && typeof memoizedProps === "object") {
      const tweet: unknown = Reflect.get(memoizedProps as object, "tweet");

      if (tweet !== null && typeof tweet === "object") {
        const value = readValue(tweet as object);

        if (value !== null) {
          return value;
        }
      }
    }

    fiber = Reflect.get(fiber as object, "return");
  }

  return null;
}

function extractLinkPathnameFromFiber(element: HTMLElement): string | null {
  const fiberKey = Object.keys(element).find((key) => key.startsWith("__reactFiber"));

  if (fiberKey === undefined) {
    return null;
  }

  let fiber: unknown = Reflect.get(element, fiberKey);

  for (let depth = 0; depth < 30; depth += 1) {
    if (fiber === null || typeof fiber !== "object") {
      break;
    }

    const memoizedProps: unknown = Reflect.get(fiber as object, "memoizedProps");

    if (memoizedProps !== null && typeof memoizedProps === "object") {
      const pathname = readPermalinkFromLink(memoizedProps as object);

      if (pathname !== null) {
        return pathname;
      }
    }

    fiber = Reflect.get(fiber as object, "return");
  }

  return null;
}

function readPermalinkFromLink(memoizedProps: object): string | null {
  const link: unknown = Reflect.get(memoizedProps, "link");

  if (link !== null && typeof link === "object") {
    const pathname: unknown = Reflect.get(link as object, "pathname");

    if (typeof pathname === "string" && /\/status\/\d+/.test(pathname)) {
      return pathname;
    }
  }

  return null;
}
