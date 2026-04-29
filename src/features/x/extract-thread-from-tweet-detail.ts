import type { SaveImageInput, SavePostInput, SaveVideoCandidateInput, VideoDownloadMode } from "../../types/archive";
import { canonicalizeTwitterImageUrl } from "./twitter-image-url";

const X_BASE_URL = "https://x.com";
const VIDEO_HOSTNAME = "video.twimg.com";

type TweetRecord = {
  id: string;
  userId: string;
  displayName: string;
  username: string;
  legacy: Record<string, unknown>;
};

export function extractThreadFromTweetDetail(
  payload: unknown,
  focalTweetId: string
): SavePostInput[] {
  const tweets = collectTweetRecords(payload);
  const focalTweet = tweets.get(focalTweetId);

  if (focalTweet === undefined) {
    return [];
  }

  const opTweets = new Map(
    [...tweets.values()]
      .filter((tweet) => tweet.userId === focalTweet.userId)
      .map((tweet) => [tweet.id, tweet])
  );

  const ancestorPath = collectAncestorPath(focalTweet, opTweets);
  const descendantPath = collectDescendantPath(focalTweet, opTweets);
  const chain = [...ancestorPath, ...descendantPath.slice(1)];
  const threadRootId = chain.length > 1 ? chain[0]?.id ?? null : null;

  return chain.map((tweet) => tweetToSavePostInput(tweet, threadRootId));
}

export function collectTweetRecords(payload: unknown): Map<string, TweetRecord> {
  const tweets = new Map<string, TweetRecord>();
  visitNode(payload, tweets, new WeakSet<object>());
  return tweets;
}

function visitNode(
  value: unknown,
  tweets: Map<string, TweetRecord>,
  seen: WeakSet<object>
): void {
  if (value === null || typeof value !== "object") {
    return;
  }

  if (seen.has(value)) {
    return;
  }

  seen.add(value);

  const tweet = readTweetRecord(value);

  if (tweet !== null) {
    tweets.set(tweet.id, tweet);
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      visitNode(item, tweets, seen);
    }

    return;
  }

  for (const child of Object.values(value)) {
    visitNode(child, tweets, seen);
  }
}

function readTweetRecord(value: object): TweetRecord | null {
  const record = value as Record<string, unknown>;
  const id = normalizeString(record.rest_id);
  const legacy = asRecord(record.legacy);
  const core = asRecord(record.core);
  const userResults = asRecord(core?.user_results);
  const user = asRecord(userResults?.result);
  const userCore = asRecord(user?.core);
  const userLegacy = asRecord(user?.legacy);
  const userId = normalizeString(user?.rest_id);
  const displayName = normalizeString(userLegacy?.name) ?? normalizeString(userCore?.name);
  const username =
    normalizeString(userLegacy?.screen_name) ?? normalizeString(userCore?.screen_name);

  if (
    id === null ||
    legacy === null ||
    userId === null ||
    displayName === null ||
    username === null
  ) {
    return null;
  }

  return {
    id,
    userId,
    displayName,
    username,
    legacy
  };
}

function collectAncestorPath(
  focalTweet: TweetRecord,
  opTweets: Map<string, TweetRecord>
): TweetRecord[] {
  const path: TweetRecord[] = [];
  const seen = new Set<string>();
  let current: TweetRecord | undefined = focalTweet;

  while (current !== undefined && !seen.has(current.id)) {
    seen.add(current.id);
    path.unshift(current);

    const parentId = normalizeString(current.legacy.in_reply_to_status_id_str);
    current = parentId === null ? undefined : opTweets.get(parentId);
  }

  return path;
}

function collectDescendantPath(
  focalTweet: TweetRecord,
  opTweets: Map<string, TweetRecord>
): TweetRecord[] {
  const childrenByParent = new Map<string, TweetRecord[]>();

  for (const tweet of opTweets.values()) {
    const parentId = normalizeString(tweet.legacy.in_reply_to_status_id_str);

    if (parentId === null) {
      continue;
    }

    const children = childrenByParent.get(parentId) ?? [];
    children.push(tweet);
    childrenByParent.set(parentId, children);
  }

  for (const children of childrenByParent.values()) {
    children.sort(compareTweetsByPostedAt);
  }

  const path = [focalTweet];
  const seen = new Set([focalTweet.id]);
  let current = focalTweet;

  while (true) {
    const next = childrenByParent.get(current.id)?.find((child) => !seen.has(child.id));

    if (next === undefined) {
      return path;
    }

    seen.add(next.id);
    path.push(next);
    current = next;
  }
}

function tweetToSavePostInput(
  tweet: TweetRecord,
  threadRootId: string | null
): SavePostInput {
  return {
    x_post_id: tweet.id,
    display_name: tweet.displayName,
    x_username: tweet.username,
    post_text: normalizeString(tweet.legacy.full_text) ?? "",
    post_url: `${X_BASE_URL}/${tweet.username}/status/${tweet.id}`,
    posted_at: normalizePostedAt(tweet.legacy.created_at),
    reply_count: normalizeCount(tweet.legacy.reply_count),
    repost_count: normalizeCount(tweet.legacy.retweet_count),
    like_count: normalizeCount(tweet.legacy.favorite_count),
    in_reply_to_post_id: normalizeString(tweet.legacy.in_reply_to_status_id_str),
    thread_root_id: threadRootId,
    media: extractImages(tweet.legacy),
    video_candidates: extractVideoCandidates(tweet.legacy)
  };
}

function extractImages(legacy: Record<string, unknown>): SaveImageInput[] {
  const images: SaveImageInput[] = [];
  const seenUrls = new Set<string>();

  for (const media of readMediaList(legacy)) {
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

function extractVideoCandidates(legacy: Record<string, unknown>): SaveVideoCandidateInput[] {
  let bestDirectMp4: SaveVideoCandidateInput | null = null;
  let bestDirectMp4Score = -1;
  let bestHls: SaveVideoCandidateInput | null = null;

  for (const media of readMediaList(legacy)) {
    const mediaType = normalizeString(media.type);

    if (mediaType !== "video" && mediaType !== "animated_gif") {
      continue;
    }

    const posterUrl = normalizeImageUrl(media.media_url_https ?? media.media_url);
    const originalInfo = asRecord(media.original_info);
    const width = normalizeNullableNumber(originalInfo?.width);
    const height = normalizeNullableNumber(originalInfo?.height);
    const videoInfo = asRecord(media.video_info);

    if (videoInfo === null || !Array.isArray(videoInfo.variants)) {
      continue;
    }

    const durationSec = normalizeDuration(videoInfo.duration_millis);

    for (const variant of videoInfo.variants) {
      const candidate = createVideoCandidate(variant, posterUrl, width, height, durationSec);

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

  return [bestDirectMp4, bestHls].filter(
    (candidate): candidate is SaveVideoCandidateInput => candidate !== null
  );
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

function createVideoCandidate(
  value: unknown,
  posterUrl: string | null,
  width: number | null,
  height: number | null,
  durationSec: number | null
): SaveVideoCandidateInput | null {
  const variant = asRecord(value);
  const sourceUrl = normalizeVideoUrl(variant?.url);

  if (variant === null || sourceUrl === null) {
    return null;
  }

  const downloadMode = detectDownloadMode(sourceUrl);

  if (downloadMode === null) {
    return null;
  }

  return {
    source_url: sourceUrl,
    poster_url: posterUrl,
    thumbnail_url: posterUrl,
    width,
    height,
    duration_sec: durationSec,
    mime_type: normalizeString(variant.content_type),
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

function compareTweetsByPostedAt(left: TweetRecord, right: TweetRecord): number {
  const postedAtDiff = normalizePostedAt(left.legacy.created_at) - normalizePostedAt(right.legacy.created_at);

  if (postedAtDiff !== 0) {
    return postedAtDiff;
  }

  return left.id.localeCompare(right.id);
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
    baseUrl: X_BASE_URL
  });
}

function normalizeVideoUrl(value: unknown): string | null {
  const rawUrl = normalizeString(value);

  if (rawUrl === null) {
    return null;
  }

  try {
    const url = new URL(rawUrl, X_BASE_URL);
    url.protocol = "https:";

    if (url.hostname !== VIDEO_HOSTNAME) {
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

function normalizeCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}

function normalizeDuration(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value / 1000
    : null;
}

function normalizePostedAt(value: unknown): number {
  const rawValue = normalizeString(value);

  if (rawValue === null) {
    return 0;
  }

  const timestamp = Date.parse(rawValue);
  return Number.isFinite(timestamp) ? timestamp : 0;
}
