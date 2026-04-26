import {
  TWEET_DETAIL_TEMPLATE_CAPTURED_EVENT,
  type TweetDetailTemplateCapturedEventDetail
} from "./tweet-detail-template-events";

const TWEET_DETAIL_PATH_PATTERN = /\/i\/api\/graphql\/[^/]+\/TweetDetail(?:\?|$)/;
const INSTALL_MARKER = "__xPostArchiveTweetDetailTemplateCaptureInstalled__";

declare global {
  interface Window {
    [INSTALL_MARKER]?: boolean;
  }
}

export function installTweetDetailTemplateCapture(): void {
  if (window[INSTALL_MARKER] === true) {
    return;
  }

  window[INSTALL_MARKER] = true;
  installFetchCapture();
  installXhrCapture();
}

function installFetchCapture(): void {
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (...args) => {
    void captureFetchTemplate(args);
    return originalFetch(...args);
  };
}

function installXhrCapture(): void {
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
  const originalSend = XMLHttpRequest.prototype.send;
  const xhrRequests = new WeakMap<
    XMLHttpRequest,
    {
      method: string;
      url: string;
      headers: Record<string, string>;
    }
  >();

  XMLHttpRequest.prototype.open = function patchedOpen(
    method: string,
    url: string | URL,
    async?: boolean,
    username?: string | null,
    password?: string | null
  ): void {
    if (typeof url === "string" || url instanceof URL) {
      xhrRequests.set(this, {
        method,
        url: url.toString(),
        headers: {}
      });
    }

    originalOpen.call(this, method, url, async ?? true, username ?? undefined, password ?? undefined);
  };

  XMLHttpRequest.prototype.setRequestHeader = function patchedSetRequestHeader(
    name: string,
    value: string
  ): void {
    const request = xhrRequests.get(this);

    if (request !== undefined) {
      request.headers[name.toLowerCase()] = value;
    }

    originalSetRequestHeader.call(this, name, value);
  };

  XMLHttpRequest.prototype.send = function patchedSend(body?: Document | XMLHttpRequestBodyInit | null): void {
    const request = xhrRequests.get(this);

    if (request !== undefined) {
      captureTemplate({
        url: request.url,
        method: request.method,
        headers: request.headers,
        body
      });
    }

    originalSend.call(this, body);
  };
}

async function captureFetchTemplate(args: Parameters<typeof fetch>): Promise<void> {
  const [input, init] = args;
  const request = await readFetchRequest(input, init);

  if (request === null) {
    return;
  }

  captureTemplate(request);
}

async function readFetchRequest(
  input: RequestInfo | URL,
  init: RequestInit | undefined
): Promise<{
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: BodyInit | null;
} | null> {
  if (input instanceof Request) {
    const headers = mergeHeaders(input.headers, init?.headers);
    const method = init?.method ?? input.method;
    let body = init?.body ?? null;

    if (body === null && method.toUpperCase() === "POST") {
      try {
        body = await input.clone().text();
      } catch {
        body = null;
      }
    }

    return {
      url: input.url,
      method,
      headers,
      body
    };
  }

  return {
    url: input.toString(),
    method: init?.method ?? "GET",
    headers: mergeHeaders(init?.headers),
    body: init?.body ?? null
  };
}

function captureTemplate(input: {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: BodyInit | Document | XMLHttpRequestBodyInit | null | undefined;
}): void {
  const parsedUrl = parseTweetDetailUrl(input.url);

  if (parsedUrl === null) {
    return;
  }

  const method = normalizeMethod(input.method);

  if (method === null) {
    return;
  }

  const payload =
    method === "GET"
      ? parseTweetDetailQuery(parsedUrl)
      : parseTweetDetailBody(input.body);

  if (payload === null) {
    return;
  }

  const detail: TweetDetailTemplateCapturedEventDetail = {
    url: parsedUrl.toString(),
    method,
    headers: input.headers,
    variables: payload.variables,
    features: payload.features,
    fieldToggles: payload.fieldToggles,
    captured_at: Date.now()
  };

  document.dispatchEvent(
    new CustomEvent<TweetDetailTemplateCapturedEventDetail>(
      TWEET_DETAIL_TEMPLATE_CAPTURED_EVENT,
      { detail }
    )
  );
}

function parseTweetDetailUrl(rawUrl: string): URL | null {
  try {
    const url = new URL(rawUrl, window.location.origin);
    return TWEET_DETAIL_PATH_PATTERN.test(`${url.pathname}${url.search}`) ? url : null;
  } catch {
    return null;
  }
}

function parseTweetDetailQuery(url: URL): ParsedTweetDetailPayload | null {
  const variables = parseJsonRecord(url.searchParams.get("variables"));

  if (variables === null) {
    return null;
  }

  return {
    variables,
    features: parseJsonRecord(url.searchParams.get("features")),
    fieldToggles: parseJsonRecord(url.searchParams.get("fieldToggles"))
  };
}

function parseTweetDetailBody(
  body: BodyInit | Document | XMLHttpRequestBodyInit | null | undefined
): ParsedTweetDetailPayload | null {
  if (typeof body !== "string") {
    return null;
  }

  const payload = parseJsonRecord(body);

  if (payload === null) {
    return null;
  }

  const variables = readRecordField(payload, "variables");

  if (variables === null) {
    return null;
  }

  return {
    variables,
    features: readRecordField(payload, "features"),
    fieldToggles: readRecordField(payload, "fieldToggles")
  };
}

type ParsedTweetDetailPayload = {
  variables: Record<string, unknown>;
  features: Record<string, unknown> | null;
  fieldToggles: Record<string, unknown> | null;
};

function parseJsonRecord(value: string | null): Record<string, unknown> | null {
  if (value === null || value.trim() === "") {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function readRecordField(
  record: Record<string, unknown>,
  key: string
): Record<string, unknown> | null {
  const value = record[key];
  return isRecord(value) ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeMethod(method: string): "GET" | "POST" | null {
  const normalized = method.toUpperCase();

  if (normalized === "GET" || normalized === "POST") {
    return normalized;
  }

  return null;
}

function mergeHeaders(...headersList: (HeadersInit | undefined)[]): Record<string, string> {
  const result: Record<string, string> = {};

  for (const headers of headersList) {
    if (headers === undefined) {
      continue;
    }

    for (const [name, value] of new Headers(headers).entries()) {
      result[name.toLowerCase()] = value;
    }
  }

  return result;
}
