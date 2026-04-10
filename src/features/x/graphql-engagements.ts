import type { GraphqlEngagementCountsByPostId } from "./graphql-engagement-events";

export function extractEngagementCountsByPostIdFromGraphqlResponse(
  payload: unknown
): GraphqlEngagementCountsByPostId[] {
  const posts = new Map<string, GraphqlEngagementCountsByPostId["counts"]>();

  visitNode(payload, posts, new WeakSet<object>());

  return [...posts.entries()].map(([xPostId, counts]) => ({
    xPostId,
    counts
  }));
}

function visitNode(
  value: unknown,
  posts: Map<string, GraphqlEngagementCountsByPostId["counts"]>,
  seen: WeakSet<object>
): void {
  if (value === null || typeof value !== "object") {
    return;
  }

  if (seen.has(value)) {
    return;
  }

  seen.add(value);

  const maybeTweet = extractTweetEngagementCounts(value);

  if (maybeTweet !== null) {
    posts.set(maybeTweet.xPostId, maybeTweet.counts);
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

function extractTweetEngagementCounts(value: object): GraphqlEngagementCountsByPostId | null {
  const record = value as Record<string, unknown>;
  const xPostId = readTweetId(record);

  if (xPostId === null) {
    return null;
  }

  const legacy = asRecord(record.legacy);

  if (legacy === null) {
    return null;
  }

  const replyCount = normalizeCount(legacy.reply_count);
  const repostCount = normalizeCount(legacy.retweet_count);
  const likeCount = normalizeCount(legacy.favorite_count);

  if (replyCount === null && repostCount === null && likeCount === null) {
    return null;
  }

  return {
    xPostId,
    counts: {
      reply_count: replyCount ?? 0,
      repost_count: repostCount ?? 0,
      like_count: likeCount ?? 0
    }
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

function normalizeCount(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}
