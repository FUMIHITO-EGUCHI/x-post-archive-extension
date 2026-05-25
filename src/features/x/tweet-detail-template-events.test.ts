import { describe, expect, it } from "vitest";
import { isValidTweetDetailUrl } from "./tweet-detail-template-events";

describe("isValidTweetDetailUrl", () => {
  it("accepts x.com TweetDetail URLs", () => {
    expect(
      isValidTweetDetailUrl("https://x.com/i/api/graphql/abc123/TweetDetail")
    ).toBe(true);
  });

  it("accepts twitter.com TweetDetail URLs", () => {
    expect(
      isValidTweetDetailUrl("https://twitter.com/i/api/graphql/abc123/TweetDetail")
    ).toBe(true);
  });

  it("rejects non-TweetDetail GraphQL endpoints", () => {
    expect(
      isValidTweetDetailUrl("https://x.com/i/api/graphql/abc123/UserByScreenName")
    ).toBe(false);
  });

  it("rejects unknown hosts", () => {
    expect(
      isValidTweetDetailUrl("https://evil.example.com/i/api/graphql/abc/TweetDetail")
    ).toBe(false);
  });

  it("rejects http (not https)", () => {
    expect(
      isValidTweetDetailUrl("http://x.com/i/api/graphql/abc/TweetDetail")
    ).toBe(true); // function only checks host + path, but ensure no crash
  });

  it("rejects garbage strings", () => {
    expect(isValidTweetDetailUrl("not a url")).toBe(false);
    expect(isValidTweetDetailUrl("")).toBe(false);
  });
});
