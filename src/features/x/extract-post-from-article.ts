import type { SavePostInput } from "../../types/archive";

const POST_PATH_PATTERN = /^\/([^/]+)\/status\/(\d+)$/;

export function extractPostFromArticle(article: HTMLElement): SavePostInput | null {
  const permalink = findPermalink(article);
  const text = extractPostText(article);

  if (permalink === null || text === null) {
    return null;
  }

  return {
    x_post_id: permalink.xPostId,
    x_username: permalink.xUsername,
    post_text: text,
    post_url: permalink.postUrl
  };
}

export function extractPostIdFromArticle(article: HTMLElement): string | null {
  const permalink = findPermalink(article);
  return permalink?.xPostId ?? null;
}

function extractPostText(article: HTMLElement): string | null {
  const tweetText = article.querySelector<HTMLElement>('[data-testid="tweetText"]');

  if (tweetText !== null) {
    const exactText = normalizeText(tweetText.textContent);

    if (exactText !== null) {
      return exactText;
    }
  }

  const langCandidates = article.querySelectorAll<HTMLElement>("div[lang]");
  let bestCandidate: string | null = null;

  for (const candidate of langCandidates) {
    if (candidate.closest('[role="button"], a, nav, header, footer') !== null) {
      continue;
    }

    const text = normalizeText(candidate.textContent);

    if (text === null) {
      continue;
    }

    if (bestCandidate === null || text.length > bestCandidate.length) {
      bestCandidate = text;
    }
  }

  return bestCandidate;
}

function normalizeText(value: string | null | undefined): string | null {
  const normalized = value?.replace(/\s+/g, " ").trim() ?? "";
  return normalized === "" ? null : normalized;
}

function findPermalink(article: HTMLElement): {
  xPostId: string;
  xUsername: string;
  postUrl: string;
} | null {
  const anchors = article.querySelectorAll<HTMLAnchorElement>('a[href*="/status/"]');

  for (const anchor of anchors) {
    const parsed = parsePermalink(anchor.href);

    if (parsed !== null) {
      return parsed;
    }
  }

  return null;
}

function parsePermalink(href: string): {
  xPostId: string;
  xUsername: string;
  postUrl: string;
} | null {
  try {
    const url = new URL(href, window.location.origin);
    const matched = url.pathname.match(POST_PATH_PATTERN);

    if (matched === null) {
      return null;
    }

    const xUsername = matched[1];
    const xPostId = matched[2];

    if (xUsername === undefined || xPostId === undefined) {
      return null;
    }

    if (xUsername.trim() === "" || xPostId.trim() === "") {
      return null;
    }

    return {
      xUsername,
      xPostId,
      postUrl: `${url.origin}${url.pathname}`
    };
  } catch {
    return null;
  }
}
