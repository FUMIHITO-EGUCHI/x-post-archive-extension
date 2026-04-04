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
let annotatorInstalled = false;
let annotatorInstallPending = false;

export function annotateQuotedPostContainers(): void {
  const articles = document.querySelectorAll<HTMLElement>('article[data-testid="tweet"]');

  for (const article of articles) {
    const container = article.querySelector<HTMLElement>(QUOTED_CONTAINER_SELECTOR);

    if (container === null || container.hasAttribute(ANNOTATION_ATTR)) {
      continue;
    }

    const permalink = extractPermalinkFromFiber(container);

    if (permalink !== null) {
      container.setAttribute(ANNOTATION_ATTR, permalink);
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

function extractPermalinkFromFiber(element: HTMLElement): string | null {
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
        const permalink: unknown = Reflect.get(tweet as object, "permalink");

        if (typeof permalink === "string") {
          return permalink;
        }
      }
    }

    fiber = Reflect.get(fiber as object, "return");
  }

  return null;
}
