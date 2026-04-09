import type { SaveImageInput } from "../../types/archive";

export const GRAPHQL_IMAGE_CANDIDATES_EVENT =
  "x-post-archive:graphql-image-candidates";

export type GraphqlImageCandidatesEventDetail = {
  posts: GraphqlImageCandidatesByPostId[];
};

export type GraphqlImageCandidatesByPostId = {
  xPostId: string;
  images: SaveImageInput[];
};
