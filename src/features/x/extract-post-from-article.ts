import type {
  SaveImageInput,
  SavePostInput
} from "../../types/archive";
import { getCachedGraphqlEngagementCounts } from "./graphql-engagement-cache";
import { getCachedGraphqlImageCandidates } from "./graphql-image-candidate-cache";
import { getCachedGraphqlVideoCandidates } from "./graphql-video-candidate-cache";
import { canonicalizeTwitterImageUrl } from "./twitter-image-url";

const POST_PATH_PATTERN = /^\/([^/]+)\/status\/(\d+)/;
const PHOTO_PATH_PATTERN = /\/photo\/(\d+)$/;
const QUOTED_POST_CONTAINER_SELECTOR = 'div[role="link"][tabindex="0"]';

export type ExtractedPostBundle = {
  post: SavePostInput;
  quotedPost: SavePostInput | null;
};

export function extractPostFromArticle(article: HTMLElement): ExtractedPostBundle | null {
  const quotedPostContainer = findQuotedPostContainer(article);
  const permalink = findPermalink(article, quotedPostContainer);

  if (permalink === null) {
    return null;
  }

  const media = mergeImageCandidates(
    extractPostImages(article, quotedPostContainer),
    getCachedGraphqlImageCandidates(permalink.xPostId)
  );
  const text = extractPostText(article, quotedPostContainer);
  const videoCandidates = getCachedGraphqlVideoCandidates(permalink.xPostId);
  const engagement = mergeEngagementCounts(
    extractEngagementCounts(article),
    getCachedGraphqlEngagementCounts(permalink.xPostId)
  );

  if (text === "" && media.length === 0 && videoCandidates.length === 0) {
    return null;
  }

  const post: SavePostInput = {
    x_post_id: permalink.xPostId,
    display_name: extractDisplayName(article, permalink.xUsername, quotedPostContainer),
    x_username: permalink.xUsername,
    post_text: text,
    post_url: permalink.postUrl,
    posted_at: extractPostedAt(article),
    reply_count: engagement.reply_count,
    repost_count: engagement.repost_count,
    like_count: engagement.like_count,
    media
  };

  if (videoCandidates.length > 0) {
    post.video_candidates = videoCandidates;
  }

  return {
    post,
    quotedPost:
      quotedPostContainer === null ? null : extractQuotedPostFromContainer(quotedPostContainer)
  };
}

export function extractPostIdFromArticle(article: HTMLElement): string | null {
  const permalink = findPermalink(article, findQuotedPostContainer(article));
  return permalink?.xPostId ?? null;
}

export function inspectArticleMediaSignals(article: HTMLElement): {
  imageHintCount: number;
  videoHintCount: number;
} {
  const quotedPostContainer = findQuotedPostContainer(article);
  const imageUrls = new Set<string>();
  const videoPosterUrls = new Set<string>();
  const photoAnchors = article.querySelectorAll<HTMLAnchorElement>('a[href*="/photo/"]');
  const tweetPhotoContainers = article.querySelectorAll<HTMLElement>('[data-testid="tweetPhoto"]');
  const playButtons = article.querySelectorAll('[data-testid="playButton"]');

  for (const image of article.querySelectorAll<HTMLImageElement>("img[src]")) {
    if (isNodeInsideContainer(image, quotedPostContainer)) {
      continue;
    }

    const normalizedImageUrl = normalizeImageUrl(image.currentSrc || image.src);

    if (normalizedImageUrl !== null) {
      imageUrls.add(normalizedImageUrl);
      continue;
    }

    const normalizedVideoPosterUrl = normalizeVideoPosterUrl(image.currentSrc || image.src);

    if (normalizedVideoPosterUrl !== null) {
      videoPosterUrls.add(normalizedVideoPosterUrl);
    }
  }

  for (const video of article.querySelectorAll<HTMLVideoElement>("video")) {
    if (isNodeInsideContainer(video, quotedPostContainer)) {
      continue;
    }

    const normalizedPosterUrl = normalizeVideoPosterUrl(video.poster);

    if (normalizedPosterUrl !== null) {
      videoPosterUrls.add(normalizedPosterUrl);
    }
  }

  const imageTweetPhotoCount = Math.max(
    0,
    countElementsOutsideContainer(tweetPhotoContainers, quotedPostContainer) -
      videoPosterUrls.size -
      countElementsOutsideContainer(playButtons, quotedPostContainer)
  );

  return {
    imageHintCount: Math.max(
      imageUrls.size,
      countElementsOutsideContainer(photoAnchors, quotedPostContainer),
      imageTweetPhotoCount
    ),
    videoHintCount: Math.max(
      videoPosterUrls.size,
      countElementsOutsideContainer(playButtons, quotedPostContainer)
    )
  };
}

function extractPostText(article: HTMLElement, exclude?: Element | null): string {
  const tweetTextCandidates = article.querySelectorAll<HTMLElement>('[data-testid="tweetText"]');

  for (const tweetText of tweetTextCandidates) {
    if (isNodeInsideContainer(tweetText, exclude)) {
      continue;
    }

    const exactText = normalizePostText(tweetText);

    if (exactText !== null) {
      return exactText;
    }
  }

  const langCandidates = article.querySelectorAll<HTMLElement>("div[lang]");
  let bestCandidate: string | null = null;

  for (const candidate of langCandidates) {
    if (
      isNodeInsideContainer(candidate, exclude) ||
      candidate.closest('[role="button"], a, nav, header, footer') !== null
    ) {
      continue;
    }

    const text = normalizePostText(candidate);

    if (text === null) {
      continue;
    }

    if (bestCandidate === null || text.length > bestCandidate.length) {
      bestCandidate = text;
    }
  }

  return bestCandidate ?? "";
}

function extractDisplayName(
  article: HTMLElement,
  fallbackUsername: string,
  exclude?: Element | null
): string {
  const userNameContainers = article.querySelectorAll<HTMLElement>('[data-testid="User-Name"]');

  for (const userNameContainer of userNameContainers) {
    if (isNodeInsideContainer(userNameContainer, exclude)) {
      continue;
    }

    const displayName = extractDisplayNameFromContainer(userNameContainer, fallbackUsername);

    if (displayName !== fallbackUsername) {
      return displayName;
    }
  }

  return fallbackUsername;
}

function extractDisplayNameFromContainer(
  userNameContainer: HTMLElement,
  fallbackUsername: string
): string {
  if (userNameContainer === null) {
    return fallbackUsername;
  }

  const candidates = userNameContainer.querySelectorAll<HTMLElement>("span");

  for (const candidate of candidates) {
    // Use innerText / DOM walk so Twemoji <img alt="😀"> in display names are preserved.
    const rawText =
      (candidate.innerText !== "" ? candidate.innerText : null) ??
      extractTextWithEmoji(candidate);
    const text = normalizeText(rawText);

    if (
      text === null ||
      text.startsWith("@") ||
      text === "·" ||
      text === "•" ||
      /^\d/.test(text)
    ) {
      continue;
    }

    return text;
  }

  return fallbackUsername;
}

/**
 * Extract text from a post element, preserving emoji from Twemoji <img alt="..."> elements.
 *
 * X renders emoji as <img alt="😀" ...> (Twemoji). `element.textContent` skips <img> entirely,
 * so emoji disappear. `element.innerText` includes <img alt> on most browsers, but can return ""
 * for off-screen/hidden elements. This function walks the DOM explicitly to handle both cases.
 */
function extractTextWithEmoji(element: Node): string {
  if (element.nodeType === Node.TEXT_NODE) {
    return element.textContent ?? "";
  }

  if (element.nodeType !== Node.ELEMENT_NODE) {
    return "";
  }

  const el = element as HTMLElement;
  const tag = el.tagName.toUpperCase();

  // Twemoji and other inline images: use alt text as the character
  if (tag === "IMG") {
    return (el as HTMLImageElement).alt ?? "";
  }

  // Block-level elements introduce a newline boundary
  const isBlock = /^(DIV|P|BR|LI|TR|BLOCKQUOTE)$/.test(tag);
  let result = "";

  for (const child of el.childNodes) {
    result += extractTextWithEmoji(child);
  }

  return isBlock ? "\n" + result : result;
}

function normalizePostText(element: HTMLElement): string | null {
  // Chrome on X can drop Twemoji <img alt> from innerText even when the text is visible.
  // Walk the DOM so inline emoji in post bodies are preserved deterministically.
  const rawText = extractTextWithEmoji(element);

  const normalized = rawText
    .replace(/\r\n?/g, "\n")
    .replace(/[^\S\n]+/g, " ")
    .trim();

  return normalized === "" ? null : normalized;
}

function extractPostImages(article: HTMLElement, exclude?: Element | null): SaveImageInput[] {
  const images: SaveImageInput[] = [];
  const seenUrls = new Set<string>();

  for (const candidate of collectMediaImageCandidates(article, exclude)) {
    const normalizedUrl = normalizeImageUrl(candidate.img.currentSrc || candidate.img.src);

    if (normalizedUrl === null || seenUrls.has(normalizedUrl)) {
      continue;
    }

    seenUrls.add(normalizedUrl);
    images.push({
      source_url: normalizedUrl,
      position:
        candidate.anchor === null
          ? images.length
          : extractPhotoPosition(candidate.anchor, images.length),
      alt_text: normalizeAltText(candidate.img.alt),
      width: normalizeDimension(candidate.img.naturalWidth || candidate.img.width),
      height: normalizeDimension(candidate.img.naturalHeight || candidate.img.height)
    });
  }

  return images
    .sort((left, right) => left.position - right.position)
    .map((image, index) => ({
      ...image,
      position: index
    }));
}

function mergeImageCandidates(
  primaryImages: SaveImageInput[],
  fallbackImages: SaveImageInput[]
): SaveImageInput[] {
  if (fallbackImages.length === 0) {
    return primaryImages;
  }

  const merged = new Map<string, SaveImageInput>();

  for (const image of fallbackImages) {
    merged.set(image.source_url, image);
  }

  for (const image of primaryImages) {
    merged.set(image.source_url, image);
  }

  return [...merged.values()]
    .sort((left, right) => left.position - right.position)
    .map((image, index) => ({
      ...image,
      position: index
    }));
}

function collectMediaImageCandidates(
  article: HTMLElement,
  exclude: Element | null = null
): Array<{
  img: HTMLImageElement;
  anchor: HTMLAnchorElement | null;
}> {
  const candidates: Array<{
    img: HTMLImageElement;
    anchor: HTMLAnchorElement | null;
  }> = [];
  const seenElements = new Set<HTMLImageElement>();
  const photoAnchors = article.querySelectorAll<HTMLAnchorElement>('a[href*="/photo/"]');

  for (const anchor of photoAnchors) {
    if (isNodeInsideContainer(anchor, exclude)) {
      continue;
    }

    const img = anchor.querySelector<HTMLImageElement>("img[src]");

    if (img === null || seenElements.has(img) || isNodeInsideContainer(img, exclude)) {
      continue;
    }

    seenElements.add(img);
    candidates.push({
      img,
      anchor
    });
  }

  for (const img of article.querySelectorAll<HTMLImageElement>('img[src*="pbs.twimg.com/media/"]')) {
    if (seenElements.has(img) || isNodeInsideContainer(img, exclude)) {
      continue;
    }

    seenElements.add(img);
    candidates.push({
      img,
      anchor: img.closest<HTMLAnchorElement>('a[href*="/photo/"]')
    });
  }

  return candidates;
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
  return canonicalizeTwitterImageUrl(src, {
    baseUrl: window.location.origin
  });
}

function normalizeVideoPosterUrl(src: string): string | null {
  try {
    const url = new URL(src, window.location.origin);

    if (
      url.hostname !== "pbs.twimg.com" ||
      ![
        "/ext_tw_video_thumb/",
        "/amplify_video_thumb/",
        "/tweet_video_thumb/"
      ].some((pathSegment) => url.pathname.includes(pathSegment))
    ) {
      return null;
    }

    url.protocol = "https:";
    return url.toString();
  } catch {
    return null;
  }
}

function findPermalink(article: ParentNode, exclude: Element | null = null): {
  xPostId: string;
  xUsername: string;
  postUrl: string;
} | null {
  const anchors = article.querySelectorAll<HTMLAnchorElement>('a[href*="/status/"]');

  for (const anchor of anchors) {
    if (isNodeInsideContainer(anchor, exclude)) {
      continue;
    }

    const parsed = parsePermalink(anchor.href);

    if (parsed !== null) {
      return parsed;
    }
  }

  return null;
}

function findQuotedPostContainer(article: HTMLElement): HTMLElement | null {
  return article.querySelector<HTMLElement>(QUOTED_POST_CONTAINER_SELECTOR);
}

function extractQuotedPostFromContainer(container: HTMLElement): SavePostInput | null {
  const permalink = findQuotedPermalink(container);

  if (permalink === null) {
    return null;
  }

  const text = extractPostText(container);
  const media = extractPostImages(container);
  const videoCandidates = getCachedGraphqlVideoCandidates(permalink.xPostId);
  const engagement = mergeEngagementCounts(
    extractEngagementCounts(container),
    getCachedGraphqlEngagementCounts(permalink.xPostId)
  );

  if (text === "" && media.length === 0 && videoCandidates.length === 0) {
    return null;
  }

  const result: SavePostInput = {
    x_post_id: permalink.xPostId,
    display_name: extractDisplayName(container, permalink.xUsername),
    x_username: permalink.xUsername,
    post_text: text,
    post_url: permalink.postUrl,
    posted_at: extractPostedAt(container),
    reply_count: engagement.reply_count,
    repost_count: engagement.repost_count,
    like_count: engagement.like_count,
    media
  };

  if (videoCandidates.length > 0) {
    result.video_candidates = videoCandidates;
  }

  return result;
}

function findQuotedPermalink(container: HTMLElement): {
  xPostId: string;
  xUsername: string;
  postUrl: string;
} | null {
  const directPermalink = findPermalink(container);

  if (directPermalink !== null) {
    return directPermalink;
  }

  return findPermalinkViaReactFiber(container);
}

function findPermalinkViaReactFiber(container: HTMLElement): {
  xPostId: string;
  xUsername: string;
  postUrl: string;
} | null {
  // The main-world content script annotates quoted post containers with
  // data-xpa-quoted-permalink (read from React Fiber) because isolated-world
  // content scripts cannot enumerate __reactFiber$* properties on DOM elements.
  const annotated = container.getAttribute("data-xpa-quoted-permalink");

  if (annotated !== null) {
    return parsePermalink(annotated);
  }

  return null;
}

function extractPostedAt(article: HTMLElement): number {
  const timeElement = article.querySelector<HTMLTimeElement>("time[datetime]");
  const datetimeValue = timeElement?.dateTime ?? timeElement?.getAttribute("datetime");
  const parsed = datetimeValue === undefined || datetimeValue === null ? Number.NaN : Date.parse(datetimeValue);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("Post timestamp could not be extracted.");
  }

  return parsed;
}

function extractEngagementCounts(article: HTMLElement): {
  reply_count: number;
  repost_count: number;
  like_count: number;
} {
  return {
    reply_count: extractActionCount(article, ["reply"]),
    repost_count: extractActionCount(article, ["retweet", "unretweet"]),
    like_count: extractActionCount(article, ["like", "unlike"])
  };
}

function mergeEngagementCounts(
  primary: {
    reply_count: number;
    repost_count: number;
    like_count: number;
  },
  fallback:
    | {
        reply_count: number;
        repost_count: number;
        like_count: number;
      }
    | null
): {
  reply_count: number;
  repost_count: number;
  like_count: number;
} {
  if (fallback === null) {
    return primary;
  }

  return {
    reply_count: primary.reply_count > 0 ? primary.reply_count : fallback.reply_count,
    repost_count: primary.repost_count > 0 ? primary.repost_count : fallback.repost_count,
    like_count: primary.like_count > 0 ? primary.like_count : fallback.like_count
  };
}

function extractActionCount(article: HTMLElement, testIds: string[]): number {
  for (const testId of testIds) {
    const action = article.querySelector<HTMLElement>(`[data-testid="${testId}"]`);

    if (action === null) {
      continue;
    }

    const count = readCountFromAction(action);

    if (count !== null) {
      return count;
    }
  }

  return 0;
}

function readCountFromAction(action: HTMLElement): number | null {
  const labelledElement = action.querySelector<HTMLElement>("[aria-label]");
  const labelCount = parseCountFromText(
    labelledElement?.getAttribute("aria-label") ?? action.getAttribute("aria-label")
  );

  if (labelCount !== null) {
    return labelCount;
  }

  const transitionText = action.querySelector<HTMLElement>('[data-testid="app-text-transition-container"]');
  const textCount = parseCountFromText(transitionText?.textContent ?? action.textContent);

  return textCount;
}

function parseCountFromText(value: string | null | undefined): number | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized === "") {
    return 0;
  }

  const match = normalized.match(/(\d+(?:[.,]\d+)?)\s*([KMBkmb万億]?)/u);

  if (match === null) {
    return 0;
  }

  const numericPart = match[1]?.replace(/,/g, "");
  const suffix = match[2] ?? "";

  if (numericPart === undefined) {
    return 0;
  }

  const parsedNumber = Number.parseFloat(numericPart);

  if (!Number.isFinite(parsedNumber) || parsedNumber < 0) {
    return 0;
  }

  const multiplier = getCountMultiplier(suffix);
  return Math.round(parsedNumber * multiplier);
}

function getCountMultiplier(suffix: string): number {
  switch (suffix.toUpperCase()) {
    case "K":
      return 1_000;
    case "M":
      return 1_000_000;
    case "B":
      return 1_000_000_000;
    case "万":
      return 10_000;
    case "億":
      return 100_000_000;
    default:
      return 1;
  }
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
      postUrl: `${url.origin}/${xUsername}/status/${xPostId}`
    };
  } catch {
    return null;
  }
}

function isNodeInsideContainer(node: Node | null, container: Element | null | undefined): boolean {
  return node !== null && container !== null && container !== undefined && container.contains(node);
}

function countElementsOutsideContainer<T extends Element>(
  elements: ArrayLike<T>,
  container: Element | null
): number {
  let count = 0;

  for (const element of Array.from(elements)) {
    if (!isNodeInsideContainer(element, container)) {
      count += 1;
    }
  }

  return count;
}
