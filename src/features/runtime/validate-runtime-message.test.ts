import { describe, expect, it } from "vitest";
import type { RuntimeMessage } from "../../types/runtime";
import { validateRuntimeMessage } from "./validate-runtime-message";

function expectOk(result: { ok: boolean }): void {
  expect(result.ok).toBe(true);
}

function expectReject(
  result: { ok: true } | { ok: false; reason: string },
  matcher: string | RegExp
): void {
  if (result.ok) {
    throw new Error("Expected validation to reject the message.");
  }

  if (typeof matcher === "string") {
    expect(result.reason).toContain(matcher);
  } else {
    expect(result.reason).toMatch(matcher);
  }
}

describe("validateRuntimeMessage", () => {
  it("accepts a valid posts/has message", () => {
    expectOk(
      validateRuntimeMessage({
        type: "posts/has",
        xPostId: "1234567890"
      } as RuntimeMessage)
    );
  });

  it("rejects posts/has with a non-numeric xPostId", () => {
    expectReject(
      validateRuntimeMessage({
        type: "posts/has",
        xPostId: "../../etc/passwd"
      } as RuntimeMessage),
      "valid X post identifier"
    );
  });

  it("rejects posts/delete with empty xPostId", () => {
    expectReject(
      validateRuntimeMessage({
        type: "posts/delete",
        xPostId: ""
      } as RuntimeMessage),
      "valid X post identifier"
    );
  });

  it("accepts posts/save-batch with valid posts", () => {
    expectOk(
      validateRuntimeMessage({
        type: "posts/save-batch",
        posts: [
          { x_post_id: "1" },
          { x_post_id: "9".repeat(19) }
        ]
      } as RuntimeMessage)
    );
  });

  it("rejects posts/save-batch when any entry has an invalid xPostId", () => {
    expectReject(
      validateRuntimeMessage({
        type: "posts/save-batch",
        posts: [
          { x_post_id: "1" },
          { x_post_id: "not-numeric" }
        ]
      } as RuntimeMessage),
      "invalid x_post_id"
    );
  });

  it("rejects posts/save-batch when entries exceed the batch cap", () => {
    const posts = Array.from({ length: 5001 }, (_, index) => ({
      x_post_id: String(index + 1)
    }));

    expectReject(
      validateRuntimeMessage({
        type: "posts/save-batch",
        posts
      } as RuntimeMessage),
      "maximum batch count"
    );
  });

  it("accepts tag.rename with bounded names", () => {
    expectOk(
      validateRuntimeMessage({
        type: "tag.rename",
        tagId: "tag-123",
        newDisplayName: "Photography"
      } as RuntimeMessage)
    );
  });

  it("rejects tag.rename when the display name is too long", () => {
    expectReject(
      validateRuntimeMessage({
        type: "tag.rename",
        tagId: "tag-123",
        newDisplayName: "x".repeat(500)
      } as RuntimeMessage),
      "exceeds maximum length"
    );
  });

  it("accepts a refetch.enqueue without xPostIds", () => {
    expectOk(
      validateRuntimeMessage({
        type: "refetch.enqueue",
        priority: "background"
      } as unknown as RuntimeMessage)
    );
  });

  it("rejects a refetch.enqueue with invalid xPostIds", () => {
    expectReject(
      validateRuntimeMessage({
        type: "refetch.enqueue",
        priority: "background",
        xPostIds: ["abc"]
      } as unknown as RuntimeMessage),
      "invalid xPostId"
    );
  });

  it("rejects a tweet-detail-template/set whose URL is not https x.com", () => {
    expectReject(
      validateRuntimeMessage({
        type: "tweet-detail-template/set",
        template: {
          url: "https://evil.example.com/i/api/graphql/abc/TweetDetail",
          method: "GET",
          headers: {},
          variables: {},
          features: null,
          fieldToggles: null,
          captured_at: 0
        },
        sessionAuth: {}
      } as RuntimeMessage),
      "host is not allowed"
    );
  });

  it("rejects tweet-detail-template/set with http (not https)", () => {
    expectReject(
      validateRuntimeMessage({
        type: "tweet-detail-template/set",
        template: {
          url: "http://x.com/i/api/graphql/abc/TweetDetail",
          method: "GET",
          headers: {},
          variables: {},
          features: null,
          fieldToggles: null,
          captured_at: 0
        },
        sessionAuth: {}
      } as RuntimeMessage),
      "must use https"
    );
  });

  it("accepts a well-formed tweet-detail-template/set", () => {
    expectOk(
      validateRuntimeMessage({
        type: "tweet-detail-template/set",
        template: {
          url: "https://x.com/i/api/graphql/abc/TweetDetail",
          method: "GET",
          headers: {},
          variables: {},
          features: null,
          fieldToggles: null,
          captured_at: 0
        },
        sessionAuth: {}
      } as RuntimeMessage)
    );
  });
});
