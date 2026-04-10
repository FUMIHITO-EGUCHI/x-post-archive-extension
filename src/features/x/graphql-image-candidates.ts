import type { SaveImageInput } from "../../types/archive";
import type { GraphqlImageCandidatesByPostId } from "./graphql-image-events";
import { canonicalizeTwitterImageUrl } from "./twitter-image-url";

const URL_BASE = "https://x.com";

export function extractImageCandidatesByPostIdFromGraphqlResponse(
  payload: unknown
): GraphqlImageCandidatesByPostId[] {
  const posts = new Map<string, SaveImageInput[]>();

  visitNode(payload, posts, new WeakSet<object>());

  return [...posts.entries()].map(([xPostId, images]) => ({
    xPostId,
    images
  }));
}

function visitNode(
  value: unknown,
  posts: Map<string, SaveImageInput[]>,
  seen: WeakSet<object>
): void {
  if (value === null || typeof value !== "object") {
    return;
  }

  if (seen.has(value)) {
    return;
  }

  seen.add(value);

  const maybeTweet = extractTweetImages(value);

  if (maybeTweet !== null) {
    posts.set(maybeTweet.xPostId, maybeTweet.images);
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      visitNode(item, posts, seen);
    }

    return;
  }

  for (const child of Object.values(value)) {
    visitNode(child, posts, seen);
  }
}

function extractTweetImages(value: object): GraphqlImageCandidatesByPostId | null {
  const record = value as Record<string, unknown>;
  const xPostId = readTweetId(record);

  if (xPostId === null) {
    return null;
  }

  const legacy = asRecord(record.legacy);

  if (legacy === null) {
    return null;
  }

  const mediaItems = readMediaList(legacy);

  if (mediaItems.length === 0) {
    return null;
  }

  const images = selectPhotoImages(mediaItems);

  if (images.length === 0) {
    return null;
  }

  return {
    xPostId,
    images
  };
}

function readTweetId(record: Record<string, unknown>): string | null {
  const restId = normalizeString(record.rest_id);

  if (restId !== null) {
    return restId;
  }

  const legacy = asRecord(record.legacy);
  return legacy === null ? null : normalizeString(legacy.id_str);
}

function readMediaList(legacy: Record<string, unknown>): Record<string, unknown>[] {
  const extendedEntities = asRecord(legacy.extended_entities);
  const extendedMedia = readMediaArray(extendedEntities?.media);

  if (extendedMedia.length > 0) {
    return extendedMedia;
  }

  const entities = asRecord(legacy.entities);
  return readMediaArray(entities?.media);
}

function readMediaArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => asRecord(item))
    .filter((item): item is Record<string, unknown> => item !== null);
}

function selectPhotoImages(mediaItems: Record<string, unknown>[]): SaveImageInput[] {
  const images: SaveImageInput[] = [];
  const seenUrls = new Set<string>();

  for (const media of mediaItems) {
    if (normalizeString(media.type) !== "photo") {
      continue;
    }

    const sourceUrl = normalizeImageUrl(media.media_url_https ?? media.media_url);

    if (sourceUrl === null || seenUrls.has(sourceUrl)) {
      continue;
    }

    seenUrls.add(sourceUrl);

    const originalInfo = asRecord(media.original_info);
    images.push({
      source_url: sourceUrl,
      position: images.length,
      alt_text: normalizeString(media.ext_alt_text),
      width: normalizeNullableNumber(originalInfo?.width),
      height: normalizeNullableNumber(originalInfo?.height)
    });
  }

  return images;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized === "" ? null : normalized;
}

function normalizeImageUrl(value: unknown): string | null {
  const rawUrl = normalizeString(value);

  if (rawUrl === null) {
    return null;
  }

  return canonicalizeTwitterImageUrl(rawUrl, {
    baseUrl: URL_BASE
  });
}

function normalizeNullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}
