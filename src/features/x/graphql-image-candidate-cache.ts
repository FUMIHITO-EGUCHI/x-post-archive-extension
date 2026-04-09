import type { SaveImageInput } from "../../types/archive";
import {
  GRAPHQL_IMAGE_CANDIDATES_EVENT,
  type GraphqlImageCandidatesEventDetail
} from "./graphql-image-events";

const cachedImagesByPostId = new Map<string, SaveImageInput[]>();
let listenerAttached = false;

export function ensureGraphqlImageCandidateListener(): void {
  if (listenerAttached) {
    return;
  }

  document.addEventListener(GRAPHQL_IMAGE_CANDIDATES_EVENT, handleCandidatesEvent as EventListener);
  listenerAttached = true;
}

export function getCachedGraphqlImageCandidates(xPostId: string): SaveImageInput[] {
  return cachedImagesByPostId.get(xPostId) ?? [];
}

function handleCandidatesEvent(event: Event): void {
  const detail = (event as CustomEvent<GraphqlImageCandidatesEventDetail>).detail;

  if (detail === null || typeof detail !== "object" || !Array.isArray(detail.posts)) {
    return;
  }

  for (const post of detail.posts) {
    if (
      post === null ||
      typeof post !== "object" ||
      typeof post.xPostId !== "string" ||
      !Array.isArray(post.images)
    ) {
      continue;
    }

    cachedImagesByPostId.set(post.xPostId, post.images);
  }
}
