export const GRAPHQL_ENGAGEMENT_COUNTS_EVENT =
  "x-post-archive:graphql-engagement-counts";

export type GraphqlEngagementCounts = {
  reply_count: number;
  repost_count: number;
  like_count: number;
};

export type GraphqlEngagementCountsByPostId = {
  xPostId: string;
  counts: GraphqlEngagementCounts;
};

export type GraphqlEngagementCountsEventDetail = {
  posts: GraphqlEngagementCountsByPostId[];
};
