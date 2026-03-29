import type { SaveImageInput, SavePostInput } from "../../types/archive";
import { extractVideoCandidatesFromArticle } from "./extract-video-candidates-from-article";

const POST_PATH_PATTERN = /^\/([^/]+)\/status\/(\d+)$/;
const PHOTO_PATH_PATTERN = /\/photo\/(\d+)$/;

export function extractPostFromArticle(article: HTMLElement): SavePostInput | null {
  const permalink = findPermalink(article);

  if (permalink === null) {
    return null;
  }

  const media = extractPostImages(article);
  const videoCandidates = extractVideoCandidatesFromArticle(article);
  const text = extractPostText(article);

  if (text === "" && media.length === 0) {
    return null;
  }

  const post: SavePostInput = {
    x_post_id: permalink.xPostId,
    x_username: permalink.xUsername,
    post_text: text,
    post_url: permalink.postUrl,
    media
  };

  if (videoCandidates.length > 0) {
    post.video_candidates = videoCandidates;
  }

  return post;
}

export function extractPostIdFromArticle(article: HTMLElement): string | null {
  const permalink = findPermalink(article);
  return permalink?.xPostId ?? null;
}

function extractPostText(article: HTMLElement): string {
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

  return bestCandidate ?? "";
}

function extractPostImages(article: HTMLElement): SaveImageInput[] {
  const photoAnchors = article.querySelectorAll<HTMLAnchorElement>('a[href*="/photo/"]');
  const images: SaveImageInput[] = [];
  const seenUrls = new Set<string>();

  for (const anchor of photoAnchors) {
    const img = anchor.querySelector<HTMLImageElement>("img[src]");

    if (img === null) {
      continue;
    }

    const normalizedUrl = normalizeImageUrl(img.currentSrc || img.src);

    if (normalizedUrl === null || seenUrls.has(normalizedUrl)) {
      continue;
    }

    seenUrls.add(normalizedUrl);
    images.push({
      source_url: normalizedUrl,
      position: extractPhotoPosition(anchor, images.length),
      alt_text: normalizeAltText(img.alt),
      width: normalizeDimension(img.naturalWidth || img.width),
      height: normalizeDimension(img.naturalHeight || img.height)
    });
  }

  return images
    .sort((left, right) => left.position - right.position)
    .map((image, index) => ({
      ...image,
      position: index
    }));
}

function normalizeText(value: string | null | undefined): string | null {
  const normalized = value?.replace(/\s+/g, " ").trim() ?? "";
  return normalized === "" ? null : normalized;
}

function normalizeAltText(value: string | null | undefined): string | null {
  const normalized = normalizeText(value);
  return normalized === null ? null : normalized;
}

function normalizeDimension(value: number): number | null {
  return Number.isFinite(value) && value > 0 ? value : null;
}

function extractPhotoPosition(anchor: HTMLAnchorElement, fallbackIndex: number): number {
  try {
    const url = new URL(anchor.href, window.location.origin);
    const matched = url.pathname.match(PHOTO_PATH_PATTERN);
    const rawPosition = matched?.[1];

    if (rawPosition === undefined) {
      return fallbackIndex;
    }

    const parsedPosition = Number.parseInt(rawPosition, 10);

    if (!Number.isInteger(parsedPosition) || parsedPosition <= 0) {
      return fallbackIndex;
    }

    return parsedPosition - 1;
  } catch {
    return fallbackIndex;
  }
}

function normalizeImageUrl(src: string): string | null {
  try {
    const url = new URL(src, window.location.origin);

    if (url.hostname !== "pbs.twimg.com" || !url.pathname.includes("/media/")) {
      return null;
    }

    url.protocol = "https:";

    if (url.searchParams.has("name")) {
      url.searchParams.set("name", "orig");
    }

    return url.toString();
  } catch {
    return null;
  }
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
