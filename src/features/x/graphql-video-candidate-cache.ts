import type { SaveVideoCandidateInput } from "../../types/archive";
import {
  GRAPHQL_VIDEO_CANDIDATES_EVENT,
  type GraphqlVideoCandidatesEventDetail
} from "./graphql-video-events";

const cachedCandidatesByPostId = new Map<string, SaveVideoCandidateInput[]>();
const MAX_CACHE_ENTRIES = 2000;
let listenerAttached = false;

export function ensureGraphqlVideoCandidateListener(): void {
  if (listenerAttached) {
    return;
  }

  document.addEventListener(GRAPHQL_VIDEO_CANDIDATES_EVENT, handleCandidatesEvent as EventListener);
  listenerAttached = true;
}

export function getCachedGraphqlVideoCandidates(xPostId: string): SaveVideoCandidateInput[] {
  return cachedCandidatesByPostId.get(xPostId) ?? [];
}

function handleCandidatesEvent(event: Event): void {
  const detail = (event as CustomEvent<GraphqlVideoCandidatesEventDetail>).detail;

  if (detail === null || typeof detail !== "object" || !Array.isArray(detail.posts)) {
    return;
  }

  for (const post of detail.posts) {
    if (
      post === null ||
      typeof post !== "object" ||
      typeof post.xPostId !== "string" ||
      !Array.isArray(post.candidates)
    ) {
      continue;
    }

    cachedCandidatesByPostId.set(post.xPostId, post.candidates);
    evictOldestEntries(cachedCandidatesByPostId);
  }
}

function evictOldestEntries<T>(cache: Map<string, T>): void {
  while (cache.size > MAX_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value;

    if (oldestKey === undefined) {
      return;
    }

    cache.delete(oldestKey);
  }
}
