import type { SaveVideoCandidateInput } from "../../types/archive";

export const GRAPHQL_VIDEO_CANDIDATES_EVENT =
  "x-post-archive:graphql-video-candidates";

export type GraphqlVideoCandidatesEventDetail = {
  posts: GraphqlVideoCandidatesByPostId[];
};

export type GraphqlVideoCandidatesByPostId = {
  xPostId: string;
  candidates: SaveVideoCandidateInput[];
};
