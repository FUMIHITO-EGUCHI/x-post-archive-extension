import type { SaveVideoCandidateInput, VideoDownloadMode } from "../../types/archive";
import type { GraphqlVideoCandidatesByPostId } from "./graphql-video-events";

const VIDEO_HOSTNAME = "video.twimg.com";
const URL_BASE = "https://x.com";
const VIDEO_TYPES = new Set(["video", "animated_gif"]);

export function extractVideoCandidatesByPostIdFromGraphqlResponse(
  payload: unknown
): GraphqlVideoCandidatesByPostId[] {
  const posts = new Map<string, SaveVideoCandidateInput[]>();

  visitNode(payload, posts, new WeakSet<object>());

  return [...posts.entries()].map(([xPostId, candidates]) => ({
    xPostId,
    candidates
  }));
}

function visitNode(
  value: unknown,
  posts: Map<string, SaveVideoCandidateInput[]>,
  seen: WeakSet<object>
): void {
  if (value === null || typeof value !== "object") {
    return;
  }

  if (seen.has(value)) {
    return;
  }

  seen.add(value);

  const maybeTweet = extractTweetVideoCandidates(value);

  if (maybeTweet !== null) {
    posts.set(maybeTweet.xPostId, maybeTweet.candidates);
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

function extractTweetVideoCandidates(
  value: object
): GraphqlVideoCandidatesByPostId | null {
  const record = value as Record<string, unknown>;
  const xPostId = readTweetId(record);

  if (xPostId === null) {
    return null;
  }

  const legacy = asRecord(record.legacy);

  if (legacy === null) {
    return null;
  }

  const media = readMediaList(legacy);

  if (media.length === 0) {
    return null;
  }

  const candidates = selectPreferredCandidates(media);

  if (candidates.length === 0) {
    return null;
  }

  return {
    xPostId,
    candidates
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

function selectPreferredCandidates(mediaItems: Record<string, unknown>[]): SaveVideoCandidateInput[] {
  const preferred: SaveVideoCandidateInput[] = [];
  let bestDirectMp4: SaveVideoCandidateInput | null = null;
  let bestDirectMp4Score = -1;
  let bestHls: SaveVideoCandidateInput | null = null;

  for (const media of mediaItems) {
    const mediaType = normalizeString(media.type);

    if (mediaType === null || !VIDEO_TYPES.has(mediaType)) {
      continue;
    }

    const posterUrl = normalizeOptionalUrl(media.media_url_https ?? media.media_url);
    const originalInfo = asRecord(media.original_info);
    const width = normalizeNullableNumber(originalInfo?.width);
    const height = normalizeNullableNumber(originalInfo?.height);

    const videoInfo = asRecord(media.video_info);

    if (videoInfo === null) {
      continue;
    }

    const durationSec = normalizeDuration(videoInfo.duration_millis);
    const variants = Array.isArray(videoInfo.variants) ? videoInfo.variants : [];

    for (const variant of variants) {
      const candidate = createCandidateFromVariant(
        variant,
        posterUrl,
        width,
        height,
        durationSec
      );

      if (candidate === null) {
        continue;
      }

      if (candidate.download_mode === "direct_mp4") {
        const score = readVariantScore(variant, width, height);

        if (score > bestDirectMp4Score) {
          bestDirectMp4 = candidate;
          bestDirectMp4Score = score;
        }

        continue;
      }

      if (bestHls === null) {
        bestHls = candidate;
      }
    }
  }

  if (bestDirectMp4 !== null) {
    preferred.push(bestDirectMp4);
  }

  if (bestHls !== null) {
    preferred.push(bestHls);
  }

  return preferred;
}

function createCandidateFromVariant(
  value: unknown,
  posterUrl: string | null,
  width: number | null,
  height: number | null,
  durationSec: number | null
): SaveVideoCandidateInput | null {
  const variant = asRecord(value);

  if (variant === null) {
    return null;
  }

  const sourceUrl = normalizeOptionalUrl(variant.url);

  if (sourceUrl === null) {
    return null;
  }

  const downloadMode = detectDownloadMode(sourceUrl);

  if (downloadMode === null) {
    return null;
  }

  const mimeType = normalizeString(variant.content_type);

  return {
    source_url: sourceUrl,
    poster_url: posterUrl,
    thumbnail_url: posterUrl,
    width,
    height,
    duration_sec: durationSec,
    mime_type: mimeType,
    download_mode: downloadMode,
    variant_key: buildVariantKey(sourceUrl, downloadMode)
  };
}

function detectDownloadMode(sourceUrl: string): VideoDownloadMode | null {
  if (sourceUrl.includes(".mp4")) {
    return "direct_mp4";
  }

  if (sourceUrl.includes(".m3u8")) {
    return "hls";
  }

  return null;
}

function buildVariantKey(sourceUrl: string, downloadMode: VideoDownloadMode): string | null {
  try {
    const url = new URL(sourceUrl);
    return `${downloadMode}:${url.pathname}`;
  } catch {
    return null;
  }
}

function readVariantScore(
  value: unknown,
  width: number | null,
  height: number | null
): number {
  const variant = asRecord(value);
  const bitrate = normalizeNullableNumber(variant?.bitrate);
  const area = (width ?? 0) * (height ?? 0);
  return (bitrate ?? 0) * 1_000_000 + area;
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

function normalizeOptionalUrl(value: unknown): string | null {
  const rawUrl = normalizeString(value);

  if (rawUrl === null) {
    return null;
  }

  try {
    const url = new URL(rawUrl, URL_BASE);
    url.protocol = "https:";

    if (url.hostname !== VIDEO_HOSTNAME && url.hostname !== "pbs.twimg.com") {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

function normalizeNullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function normalizeDuration(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value / 1000
    : null;
}
