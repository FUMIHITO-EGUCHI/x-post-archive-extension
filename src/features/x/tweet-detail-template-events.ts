export const TWEET_DETAIL_TEMPLATE_CAPTURED_EVENT =
  "x-post-archive:tweet-detail-template-captured";

export type TweetDetailTemplateCapturedEventDetail = {
  url: string;
  method: "GET" | "POST";
  headers: Record<string, string>;
  variables: Record<string, unknown>;
  features: Record<string, unknown> | null;
  fieldToggles: Record<string, unknown> | null;
  captured_at: number;
};
