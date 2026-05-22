export const TWEET_DETAIL_TEMPLATE_CAPTURED_EVENT =
  "x-post-archive:tweet-detail-template-captured";

const TWEET_DETAIL_ALLOWED_HOSTS = new Set(["x.com", "twitter.com"]);
const TWEET_DETAIL_PATH_PATTERN = /^\/i\/api\/graphql\/[^/]+\/TweetDetail$/;

export function isValidTweetDetailUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    return (
      TWEET_DETAIL_ALLOWED_HOSTS.has(url.hostname) &&
      TWEET_DETAIL_PATH_PATTERN.test(url.pathname)
    );
  } catch {
    return false;
  }
}

export type TweetDetailTemplateSessionAuthDetail = {
  authorization?: string;
  "x-client-transaction-id"?: string;
  "x-client-uuid"?: string;
};

export type TweetDetailTemplateCapturedEventDetail = {
  url: string;
  method: "GET" | "POST";
  headers: Record<string, string>;
  variables: Record<string, unknown>;
  features: Record<string, unknown> | null;
  fieldToggles: Record<string, unknown> | null;
  captured_at: number;
  session_auth: TweetDetailTemplateSessionAuthDetail;
  handshake_token: string;
};
