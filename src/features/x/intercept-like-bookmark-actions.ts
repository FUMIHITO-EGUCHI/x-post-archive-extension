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

// Why: every failure path in this interceptor used to fail silently (#126), making "the save
// did not fire when I liked" impossible to diagnose. Misses are dispatched to the ISOLATED
// world, which persists them to the extension log. Payloads carry no post ids, request bodies,
// or query strings — only the GraphQL operation name and a short failure detail.
export const AUTO_ARCHIVE_MISS_EVENT = "x-post-archive:auto-archive-miss";

export type AutoArchiveMissReason =
  | "endpoint_unmatched"
  | "xhr_response_type"
  | "tweet_id_missing"
  | "response_not_ok"
  | "response_not_json"
  | "response_empty"
  | "response_parse_error"
  | "payload_shape";

export type AutoArchiveMissEventDetail = {
  reason: AutoArchiveMissReason;
  action: LikeBookmarkActionEventDetail["action"] | null;
  endpoint: string | null;
  detail: string | null;
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
    const rawUrl = typeof url === "string" ? url : url.toString();
    const action = resolveActionByUrl(rawUrl);
    xhrActions.set(this, action);
    xhrPostIds.set(this, null);

    if (action === null) {
      reportUnmatchedActionEndpoint(rawUrl, method);
    }

    this.addEventListener("loadend", () => {
      const action = xhrActions.get(this) ?? null;
      const xPostId = xhrPostIds.get(this) ?? null;

      if (action === null || xPostId === null) {
        return;
      }

      if (this.responseType !== "" && this.responseType !== "text") {
        dispatchMiss({
          reason: "xhr_response_type",
          action,
          endpoint: null,
          detail: String(this.responseType)
        });
        return;
      }

      if (typeof this.responseText !== "string" || this.responseText.trim() === "") {
        dispatchMiss({
          reason: "response_empty",
          action,
          endpoint: null,
          detail: null
        });
        return;
      }

      try {
        const payload = JSON.parse(this.responseText) as unknown;

        if (isSuccessfulActionPayload(action, payload)) {
          dispatchAction({
            action,
            xPostId
          });
        } else {
          dispatchMiss({
            reason: "payload_shape",
            action,
            endpoint: null,
            detail: null
          });
        }
      } catch {
        dispatchMiss({
          reason: "response_parse_error",
          action,
          endpoint: null,
          detail: null
        });
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
      } else {
        dispatchMiss({
          reason: "tweet_id_missing",
          action,
          endpoint: null,
          detail: describeBodyKind(body)
        });
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

  const action = resolveActionByUrl(requestUrl);

  if (action === null) {
    const method =
      init?.method ?? (input instanceof Request ? input.method : "GET");
    reportUnmatchedActionEndpoint(requestUrl, method);
    return null;
  }

  const requestBody =
    typeof init?.body === "string"
      ? init.body
      : input instanceof Request
        ? await safeReadRequestBody(input)
        : null;
  const xPostId = extractTweetIdFromBody(requestBody);

  if (xPostId === null) {
    dispatchMiss({
      reason: "tweet_id_missing",
      action,
      endpoint: null,
      detail:
        requestBody !== null
          ? "string_unparseable"
          : input instanceof Request
            ? "request_body_unreadable"
            : describeBodyKind(init?.body ?? null)
    });
    return null;
  }

  return {
    action,
    xPostId
  };
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

async function inspectResponse(
  request: LikeBookmarkActionEventDetail,
  response: Response
): Promise<void> {
  if (!response.ok) {
    dispatchMiss({
      reason: "response_not_ok",
      action: request.action,
      endpoint: null,
      detail: String(response.status)
    });
    return;
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    dispatchMiss({
      reason: "response_not_json",
      action: request.action,
      endpoint: null,
      detail: contentType.slice(0, 100)
    });
    return;
  }

  try {
    const payload = (await response.json()) as unknown;

    if (!isSuccessfulActionPayload(request.action, payload)) {
      dispatchMiss({
        reason: "payload_shape",
        action: request.action,
        endpoint: null,
        detail: null
      });
      return;
    }

    dispatchAction(request);
  } catch {
    dispatchMiss({
      reason: "response_parse_error",
      action: request.action,
      endpoint: null,
      detail: null
    });
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

  const tweetBookmarkPut = Reflect.get(data, "tweet_bookmark_put");

  if (tweetBookmarkPut === "Done") {
    return true;
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

function dispatchMiss(detail: AutoArchiveMissEventDetail): void {
  try {
    document.dispatchEvent(
      new CustomEvent<AutoArchiveMissEventDetail>(AUTO_ARCHIVE_MISS_EVENT, {
        detail
      })
    );
  } catch {
    // Diagnostics must never break the page's own request flow.
  }
}

const reportedUnmatchedEndpoints = new Set<string>();

// Detects like/bookmark-shaped GraphQL mutations this interceptor does not recognize (e.g. a
// renamed or versioned endpoint after an X deploy) — the silent failure mode of the exact-name
// match in resolveActionByUrl. Undo/list operations (Unfavorite*, DeleteBookmark, Bookmarks
// timeline fetches) are excluded; each unmatched name is reported once per page load.
function reportUnmatchedActionEndpoint(rawUrl: string, method: string | undefined): void {
  try {
    if ((method ?? "GET").toUpperCase() !== "POST") {
      return;
    }

    const url = new URL(rawUrl, window.location.origin);

    if (!url.pathname.includes(GRAPHQL_PATH_SEGMENT)) {
      return;
    }

    const operationName = url.pathname.split("/").pop() ?? "";

    if (
      operationName === "" ||
      !/favorite|bookmark/i.test(operationName) ||
      /^(?:un|delete|remove)/i.test(operationName) ||
      reportedUnmatchedEndpoints.has(operationName)
    ) {
      return;
    }

    reportedUnmatchedEndpoints.add(operationName);
    dispatchMiss({
      reason: "endpoint_unmatched",
      action: null,
      endpoint: operationName.slice(0, 100),
      detail: null
    });
  } catch {
    // Diagnostics only.
  }
}

function describeBodyKind(body: unknown): string {
  if (body === null || body === undefined) {
    return "none";
  }

  if (typeof body === "string") {
    return "string_unparseable";
  }

  const constructorName = (body as { constructor?: { name?: string } }).constructor?.name;
  return typeof constructorName === "string" && constructorName !== ""
    ? constructorName
    : typeof body;
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
