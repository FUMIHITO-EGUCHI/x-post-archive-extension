const GRAPHQL_PATH_SEGMENT = "/i/api/graphql/";
const INSTALL_MARKER = "__xPostArchiveLikeBookmarkInterceptorInstalled__";
const xhrActions = new WeakMap<XMLHttpRequest, LikeBookmarkActionEventDetail["action"] | null>();
const xhrPostIds = new WeakMap<XMLHttpRequest, string | null>();

export const LIKE_BOOKMARK_ACTION_EVENT =
  "x-post-archive:like-bookmark-action";

export type LikeBookmarkActionEventDetail = {
  action: "like" | "bookmark";
  xPostId: string;
};

declare global {
  interface Window {
    [INSTALL_MARKER]?: boolean;
  }
}

export function installLikeBookmarkInterceptor(): void {
  if (window[INSTALL_MARKER] === true) {
    return;
  }

  window[INSTALL_MARKER] = true;
  installFetchInterceptor();
  installXhrInterceptor();
}

function installFetchInterceptor(): void {
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (...args) => {
    const requestPromise = resolveFetchRequest(args);
    const response = await originalFetch(...args);
    const request = await requestPromise;

    if (request !== null) {
      void inspectResponse(request, response.clone());
    }

    return response;
  };
}

function installXhrInterceptor(): void {
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function patchedOpen(
    method: string,
    url: string | URL,
    async?: boolean,
    username?: string | null,
    password?: string | null
  ): void {
    const request = resolveActionRequest(typeof url === "string" ? url : url.toString(), null);
    xhrActions.set(this, request?.action ?? null);
    xhrPostIds.set(this, request?.xPostId ?? null);

    this.addEventListener("loadend", () => {
      const action = xhrActions.get(this) ?? null;
      const xPostId = xhrPostIds.get(this) ?? null;

      if (action === null || xPostId === null) {
        return;
      }

      if (this.responseType !== "" && this.responseType !== "text") {
        return;
      }

      if (typeof this.responseText !== "string" || this.responseText.trim() === "") {
        return;
      }

      try {
        const payload = JSON.parse(this.responseText) as unknown;

        if (isSuccessfulActionPayload(action, payload)) {
          dispatchAction({
            action,
            xPostId
          });
        }
      } catch {
        // Ignore malformed JSON responses.
      }
    });

    originalOpen.call(this, method, url, async ?? true, username ?? undefined, password ?? undefined);
  };

  XMLHttpRequest.prototype.send = function patchedSend(body?: Document | XMLHttpRequestBodyInit | null): void {
    const action = xhrActions.get(this) ?? null;

    if (action !== null && action !== undefined) {
      const xPostId = extractTweetIdFromBody(body);

      if (xPostId !== null) {
        xhrPostIds.set(this, xPostId);
      }
    }

    originalSend.call(this, body);
  };
}

async function resolveFetchRequest(
  args: Parameters<typeof fetch>
): Promise<LikeBookmarkActionEventDetail | null> {
  const [input, init] = args;
  const requestUrl = resolveFetchRequestUrl(args);

  if (requestUrl === null) {
    return null;
  }

  const requestBody =
    typeof init?.body === "string"
      ? init.body
      : input instanceof Request
        ? await safeReadRequestBody(input)
        : null;

  return resolveActionRequest(requestUrl, requestBody);
}

function resolveFetchRequestUrl(args: Parameters<typeof fetch>): string | null {
  const [input] = args;

  if (typeof input === "string") {
    return normalizeGraphqlUrl(input);
  }

  if (input instanceof URL) {
    return normalizeGraphqlUrl(input.toString());
  }

  if (input instanceof Request) {
    return normalizeGraphqlUrl(input.url);
  }

  return null;
}

function resolveActionRequest(
  rawUrl: string,
  requestBody: string | null
): LikeBookmarkActionEventDetail | null {
  const action = resolveActionByUrl(rawUrl);
  const xPostId = extractTweetIdFromBody(requestBody);

  if (action === null || xPostId === null) {
    return null;
  }

  return {
    action,
    xPostId
  };
}

async function inspectResponse(
  request: LikeBookmarkActionEventDetail,
  response: Response
): Promise<void> {
  if (!response.ok) {
    return;
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    return;
  }

  try {
    const payload = (await response.json()) as unknown;

    if (!isSuccessfulActionPayload(request.action, payload)) {
      return;
    }

    dispatchAction(request);
  } catch {
    // Ignore malformed JSON responses.
  }
}

function resolveActionByUrl(rawUrl: string): LikeBookmarkActionEventDetail["action"] | null {
  try {
    const url = new URL(rawUrl, window.location.origin);

    if (!url.pathname.includes(GRAPHQL_PATH_SEGMENT)) {
      return null;
    }

    if (url.pathname.endsWith("/FavoriteTweet")) {
      return "like";
    }

    if (url.pathname.endsWith("/CreateBookmark")) {
      return "bookmark";
    }

    return null;
  } catch {
    return null;
  }
}

function normalizeGraphqlUrl(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl, window.location.origin);

    if (!url.pathname.includes(GRAPHQL_PATH_SEGMENT)) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

function extractTweetIdFromBody(body: unknown): string | null {
  if (typeof body !== "string" || body.trim() === "") {
    return null;
  }

  try {
    const payload = JSON.parse(body) as unknown;
    const variables = readObjectProperty(payload, "variables");
    const tweetId = variables === null ? null : Reflect.get(variables, "tweet_id");

    return typeof tweetId === "string" && tweetId.trim() !== "" ? tweetId.trim() : null;
  } catch {
    return null;
  }
}

function isSuccessfulActionPayload(
  action: LikeBookmarkActionEventDetail["action"],
  payload: unknown
): boolean {
  const data = readObjectProperty(payload, "data");

  if (data === null) {
    return false;
  }

  if (action === "like") {
    const favoriteTweet = Reflect.get(data, "favorite_tweet");
    return favoriteTweet === "Done";
  }

  const bookmarkResult = readObjectProperty(data, "bookmark_tweet_result");
  const result = bookmarkResult === null ? null : readObjectProperty(bookmarkResult, "result");
  const typename = result === null ? null : Reflect.get(result, "__typename");

  return typename === "Tweet";
}

function dispatchAction(detail: LikeBookmarkActionEventDetail): void {
  document.dispatchEvent(
    new CustomEvent<LikeBookmarkActionEventDetail>(LIKE_BOOKMARK_ACTION_EVENT, {
      detail
    })
  );
}

function readObjectProperty(value: unknown, key: string): Record<string, unknown> | null {
  if (value === null || typeof value !== "object") {
    return null;
  }

  const candidate = Reflect.get(value, key);
  return candidate !== null && typeof candidate === "object"
    ? (candidate as Record<string, unknown>)
    : null;
}

async function safeReadRequestBody(request: Request): Promise<string | null> {
  try {
    return await request.clone().text();
  } catch {
    return null;
  }
}
