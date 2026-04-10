import type { GraphqlEngagementCounts } from "./graphql-engagement-events";
import {
  GRAPHQL_ENGAGEMENT_COUNTS_EVENT,
  type GraphqlEngagementCountsEventDetail
} from "./graphql-engagement-events";

const cachedCountsByPostId = new Map<string, GraphqlEngagementCounts>();
let listenerAttached = false;

export function ensureGraphqlEngagementListener(): void {
  if (listenerAttached) {
    return;
  }

  document.addEventListener(
    GRAPHQL_ENGAGEMENT_COUNTS_EVENT,
    handleEngagementEvent as EventListener
  );
  listenerAttached = true;
}

export function getCachedGraphqlEngagementCounts(
  xPostId: string
): GraphqlEngagementCounts | null {
  return cachedCountsByPostId.get(xPostId) ?? null;
}

function handleEngagementEvent(event: Event): void {
  const detail = (event as CustomEvent<GraphqlEngagementCountsEventDetail>).detail;

  if (detail === null || typeof detail !== "object" || !Array.isArray(detail.posts)) {
    return;
  }

  for (const post of detail.posts) {
    if (
      post === null ||
      typeof post !== "object" ||
      typeof post.xPostId !== "string" ||
      post.counts === null ||
      typeof post.counts !== "object"
    ) {
      continue;
    }

    cachedCountsByPostId.set(post.xPostId, {
      reply_count:
        typeof post.counts.reply_count === "number" && Number.isFinite(post.counts.reply_count)
          ? post.counts.reply_count
          : 0,
      repost_count:
        typeof post.counts.repost_count === "number" && Number.isFinite(post.counts.repost_count)
          ? post.counts.repost_count
          : 0,
      like_count:
        typeof post.counts.like_count === "number" && Number.isFinite(post.counts.like_count)
          ? post.counts.like_count
          : 0
    });
  }
}
