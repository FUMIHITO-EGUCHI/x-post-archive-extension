import type { SavePostInput } from "../../types/archive";
import type { TweetDetailClientError, TweetDetailTemplateRecord } from "../../types/thread";
import { collectTweetRecords, extractThreadFromTweetDetail } from "./extract-thread-from-tweet-detail";

export type TweetDetailResponse =
  | {
      ok: true;
      focalTweetId: string;
      posts: SavePostInput[];
      tweetCount: number;
      payload: unknown;
    }
  | {
      ok: false;
      error: TweetDetailClientError;
      status?: number;
      message?: string;
    };

type CookieDependency = {
  get(details: { url: string; name: string }): Promise<{ value?: string } | undefined>;
};

type FetchDependency = typeof fetch;
type TemplateDependency = () => Promise<TweetDetailTemplateRecord | undefined>;

export async function fetchTweetDetail(
  focalTweetId: string,
  dependencies: {
    cookies?: CookieDependency;
    fetchImpl?: FetchDependency;
    getTemplate?: TemplateDependency;
  } = {}
): Promise<TweetDetailResponse> {
  const template = await dependencies.getTemplate?.();

  if (template === undefined) {
    return {
      ok: false,
      error: "template-missing"
    };
  }

  const cookies = dependencies.cookies ?? chrome.cookies;
  const csrfCookie = await cookies.get({
    url: "https://x.com",
    name: "ct0"
  });
  const csrfToken = normalizeString(csrfCookie?.value);

  if (csrfToken === null) {
    return {
      ok: false,
      error: "not-logged-in"
    };
  }

  const request = buildTweetDetailRequest(template, focalTweetId, csrfToken);
  const fetchImpl = dependencies.fetchImpl ?? fetch;

  try {
    const response = await fetchImpl(request.url, request.init);

    if (!response.ok) {
      return createHttpErrorResponse(response.status);
    }

    const payload = (await response.json()) as unknown;

    return {
      ok: true,
      focalTweetId,
      posts: extractThreadFromTweetDetail(payload, focalTweetId),
      tweetCount: collectTweetRecords(payload).size,
      payload
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : undefined;

    return {
      ok: false,
      error: "unknown",
      ...(message === undefined ? {} : { message })
    };
  }
}

export function buildTweetDetailRequest(
  template: TweetDetailTemplateRecord,
  focalTweetId: string,
  csrfToken: string
): {
  url: string;
  init: RequestInit;
} {
  const variables = {
    ...template.variables,
    focalTweetId
  };
  const headers = sanitizeTemplateHeaders(template.headers);
  headers["x-csrf-token"] = csrfToken;

  if (template.method === "GET") {
    const url = new URL(template.url);
    url.searchParams.set("variables", JSON.stringify(variables));
    setJsonQueryParam(url, "features", template.features);
    setJsonQueryParam(url, "fieldToggles", template.fieldToggles);

    return {
      url: url.toString(),
      init: {
        method: "GET",
        headers,
        credentials: "include"
      }
    };
  }

  return {
    url: template.url,
    init: {
      method: "POST",
      headers,
      credentials: "include",
      body: JSON.stringify({
        variables,
        ...(template.features === null ? {} : { features: template.features }),
        ...(template.fieldToggles === null ? {} : { fieldToggles: template.fieldToggles })
      })
    }
  };
}

function sanitizeTemplateHeaders(headers: Record<string, string>): Record<string, string> {
  const sanitized: Record<string, string> = {};

  for (const [rawName, value] of Object.entries(headers)) {
    const name = rawName.toLowerCase();

    if (name === "cookie" || name === "content-length" || name.startsWith(":")) {
      continue;
    }

    sanitized[name] = value;
  }

  return sanitized;
}

function setJsonQueryParam(
  url: URL,
  key: string,
  value: Record<string, unknown> | null
): void {
  if (value === null) {
    url.searchParams.delete(key);
    return;
  }

  url.searchParams.set(key, JSON.stringify(value));
}

function createHttpErrorResponse(status: number): TweetDetailResponse {
  if (status === 401 || status === 403) {
    return {
      ok: false,
      error: "auth-stale",
      status
    };
  }

  if (status === 429) {
    return {
      ok: false,
      error: "rate-limited",
      status
    };
  }

  return {
    ok: false,
    error: "unknown",
    status
  };
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized === "" ? null : normalized;
}
