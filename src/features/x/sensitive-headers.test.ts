import { describe, expect, it } from "vitest";
import {
  isSensitiveTemplateHeaderName,
  stripSensitiveTemplateHeaders
} from "./sensitive-headers";

describe("isSensitiveTemplateHeaderName", () => {
  it("flags authorization header regardless of case", () => {
    expect(isSensitiveTemplateHeaderName("Authorization")).toBe(true);
    expect(isSensitiveTemplateHeaderName("authorization")).toBe(true);
    expect(isSensitiveTemplateHeaderName("AUTHORIZATION")).toBe(true);
  });

  it("flags the X CSRF / transaction / uuid headers", () => {
    expect(isSensitiveTemplateHeaderName("x-csrf-token")).toBe(true);
    expect(isSensitiveTemplateHeaderName("X-Client-Transaction-Id")).toBe(true);
    expect(isSensitiveTemplateHeaderName("x-client-uuid")).toBe(true);
  });

  it("does not flag innocuous headers", () => {
    expect(isSensitiveTemplateHeaderName("accept-language")).toBe(false);
    expect(isSensitiveTemplateHeaderName("content-type")).toBe(false);
    expect(isSensitiveTemplateHeaderName("x-twitter-client-language")).toBe(false);
  });
});

describe("stripSensitiveTemplateHeaders", () => {
  it("removes authentication-bearing headers and keeps the rest", () => {
    const input = {
      Authorization: "Bearer abc",
      "x-csrf-token": "csrf",
      "X-Client-Transaction-Id": "tx",
      "x-client-uuid": "uuid",
      "accept-language": "en-US",
      "content-type": "application/json",
      "x-twitter-client-language": "en"
    };

    const result = stripSensitiveTemplateHeaders(input);

    expect(result).toEqual({
      "accept-language": "en-US",
      "content-type": "application/json",
      "x-twitter-client-language": "en"
    });
    expect(Object.keys(result)).not.toContain("authorization");
  });

  it("returns lowercase header names", () => {
    const result = stripSensitiveTemplateHeaders({ "Accept-Language": "ja" });
    expect(Object.keys(result)).toEqual(["accept-language"]);
  });

  it("skips non-string values defensively", () => {
    const input = {
      "accept-language": "ja",
      "x-bogus": 42 as unknown as string
    };
    const result = stripSensitiveTemplateHeaders(input);
    expect(result).toEqual({ "accept-language": "ja" });
  });
});
