import type { SaveVideoCandidateInput } from "../../types/archive";
import {
  GRAPHQL_VIDEO_CANDIDATES_EVENT,
  type GraphqlVideoCandidatesEventDetail
} from "./graphql-video-events";

const cachedCandidatesByPostId = new Map<string, SaveVideoCandidateInput[]>();
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
  }
}
