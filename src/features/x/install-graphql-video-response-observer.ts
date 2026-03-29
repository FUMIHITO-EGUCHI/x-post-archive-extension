import { extractVideoCandidatesByPostIdFromGraphqlResponse } from "./graphql-video-candidates";
import {
  GRAPHQL_VIDEO_CANDIDATES_EVENT,
  type GraphqlVideoCandidatesEventDetail
} from "./graphql-video-events";

const GRAPHQL_PATH_SEGMENT = "/i/api/graphql/";
const INSTALL_MARKER = "__xPostArchiveGraphqlVideoObserverInstalled__";

declare global {
  interface Window {
    [INSTALL_MARKER]?: boolean;
  }
}

export function installGraphqlVideoResponseObserver(): void {
  if (window[INSTALL_MARKER] === true) {
    return;
  }

  window[INSTALL_MARKER] = true;

  installFetchObserver();
  installXhrObserver();
}

function installFetchObserver(): void {
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (...args) => {
    const response = await originalFetch(...args);
    const requestUrl = resolveFetchRequestUrl(args);

    if (requestUrl !== null) {
      void inspectJsonResponse(requestUrl, response.clone());
    }

    return response;
  };
}

function installXhrObserver(): void {
  const originalOpen = XMLHttpRequest.prototype.open;

  XMLHttpRequest.prototype.open = function patchedOpen(
    method: string,
    url: string | URL,
    async?: boolean,
    username?: string | null,
    password?: string | null
  ): void {
    this.addEventListener("loadend", () => {
      if (typeof url !== "string" && !(url instanceof URL)) {
        return;
      }

      const requestUrl = normalizeGraphqlUrl(url.toString());

      if (requestUrl === null) {
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
        dispatchCandidates(payload);
      } catch {
        // Ignore malformed or non-JSON responses.
      }
    });

    originalOpen.call(this, method, url, async ?? true, username ?? undefined, password ?? undefined);
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

async function inspectJsonResponse(requestUrl: string, response: Response): Promise<void> {
  if (!response.ok) {
    return;
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    return;
  }

  try {
    const payload = (await response.json()) as unknown;

    if (normalizeGraphqlUrl(requestUrl) === null) {
      return;
    }

    dispatchCandidates(payload);
  } catch {
    // Ignore malformed JSON responses.
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

function dispatchCandidates(payload: unknown): void {
  const posts = extractVideoCandidatesByPostIdFromGraphqlResponse(payload);

  if (posts.length === 0) {
    return;
  }

  const detail: GraphqlVideoCandidatesEventDetail = {
    posts
  };

  document.dispatchEvent(
    new CustomEvent<GraphqlVideoCandidatesEventDetail>(GRAPHQL_VIDEO_CANDIDATES_EVENT, {
      detail
    })
  );
}
