import type { LikeBookmarkActionObservedMessage } from "../../types/runtime";
import { createLogger } from "../logging/logger";

// Why: the MAIN-world fetch/XHR interceptor cannot see action requests X issues from its own
// service worker (observed in the photo-lightbox flow, #128). webRequest observes every
// transport. This is a fallback: the content script delays and dedupes against the interceptor
// path, which stays primary because it validates the response payload, not just the status.
const logger = createLogger("action-observer");

const ACTION_URL_PATTERNS = [
  "https://x.com/i/api/graphql/*",
  "https://twitter.com/i/api/graphql/*"
];
const CONTENT_TAB_URL_PATTERNS = ["https://x.com/*", "https://twitter.com/*"];
const PENDING_REQUEST_LIMIT = 200;

type PendingAction = {
  action: LikeBookmarkActionObservedMessage["action"];
  xPostId: string;
  tabId: number;
};

type ObservedRequestBody = {
  raw?: Array<{ bytes?: ArrayBuffer }>;
} | null;

const pendingActionsByRequestId = new Map<string, PendingAction>();

export function installLikeBookmarkActionObserver(): void {
  const webRequest = browser.webRequest;

  if (webRequest === undefined) {
    logger.warn("action_observer.unavailable");
    return;
  }

  webRequest.onBeforeRequest.addListener(
    (details) => {
      if (details.method !== "POST") {
        return undefined;
      }

      const action = resolveActionFromUrl(details.url);

      if (action === null) {
        return undefined;
      }

      const xPostId = extractTweetIdFromRequestBody(details.requestBody as ObservedRequestBody);

      if (xPostId === null) {
        return undefined;
      }

      if (pendingActionsByRequestId.size >= PENDING_REQUEST_LIMIT) {
        pendingActionsByRequestId.clear();
      }

      pendingActionsByRequestId.set(details.requestId, {
        action,
        xPostId,
        tabId: details.tabId
      });
      return undefined;
    },
    { urls: ACTION_URL_PATTERNS },
    ["requestBody"]
  );

  // Notify only after the server acknowledged the request — a failed action must not archive.
  webRequest.onCompleted.addListener(
    (details) => {
      const pending = pendingActionsByRequestId.get(details.requestId);
      pendingActionsByRequestId.delete(details.requestId);

      if (pending === undefined || details.statusCode < 200 || details.statusCode >= 300) {
        return;
      }

      void notifyContentScript(pending);
    },
    { urls: ACTION_URL_PATTERNS }
  );

  webRequest.onErrorOccurred.addListener(
    (details) => {
      pendingActionsByRequestId.delete(details.requestId);
    },
    { urls: ACTION_URL_PATTERNS }
  );
}

async function notifyContentScript(pending: PendingAction): Promise<void> {
  const message: LikeBookmarkActionObservedMessage = {
    type: "auto-archive/action-observed",
    action: pending.action,
    xPostId: pending.xPostId
  };

  // Requests issued by X's service worker carry no tab id; fall back to every X tab — the tab
  // showing the post handles it, the rest fail the article lookup and stay silent.
  const tabIds =
    pending.tabId >= 0
      ? [pending.tabId]
      : (await browser.tabs.query({ url: CONTENT_TAB_URL_PATTERNS }))
          .map((tab) => tab.id)
          .filter((tabId): tabId is number => tabId !== undefined);

  const deliveries: string[] = [];

  for (const tabId of tabIds) {
    try {
      await browser.tabs.sendMessage(tabId, message);
      deliveries.push(`${tabId}:ok`);
    } catch (error) {
      // Tab without an injected content script (e.g. still loading) — nothing to notify.
      deliveries.push(`${tabId}:${error instanceof Error ? error.message.slice(0, 40) : "error"}`);
    }
  }

  logger.debug("auto_archive.action_observed", {
    context: {
      action: pending.action,
      fromServiceWorker: pending.tabId < 0,
      deliveries: deliveries.join(", ")
    }
  });
}

function resolveActionFromUrl(rawUrl: string): PendingAction["action"] | null {
  try {
    const pathname = new URL(rawUrl).pathname;

    if (pathname.endsWith("/FavoriteTweet")) {
      return "like";
    }

    if (pathname.endsWith("/CreateBookmark")) {
      return "bookmark";
    }

    return null;
  } catch {
    return null;
  }
}

function extractTweetIdFromRequestBody(requestBody: ObservedRequestBody | undefined): string | null {
  const bytes = requestBody?.raw?.[0]?.bytes;

  if (bytes === undefined) {
    return null;
  }

  try {
    const payload = JSON.parse(new TextDecoder().decode(bytes)) as unknown;

    if (payload === null || typeof payload !== "object") {
      return null;
    }

    const variables = Reflect.get(payload, "variables") as unknown;

    if (variables === null || typeof variables !== "object") {
      return null;
    }

    const tweetId = Reflect.get(variables, "tweet_id") as unknown;
    return typeof tweetId === "string" && tweetId.trim() !== "" ? tweetId.trim() : null;
  } catch {
    return null;
  }
}
