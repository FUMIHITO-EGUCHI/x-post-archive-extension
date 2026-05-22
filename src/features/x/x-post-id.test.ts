import { describe, expect, it } from "vitest";
import { isOpfsSafePathSegment, isValidXPostId } from "./x-post-id";

describe("isValidXPostId", () => {
  it("accepts ordinary numeric post identifiers", () => {
    expect(isValidXPostId("1830000000000000000")).toBe(true);
    expect(isValidXPostId("1")).toBe(true);
  });

  it("rejects non-string inputs", () => {
    expect(isValidXPostId(1)).toBe(false);
    expect(isValidXPostId(null)).toBe(false);
    expect(isValidXPostId(undefined)).toBe(false);
    expect(isValidXPostId({})).toBe(false);
  });

  it("rejects strings containing non-digit characters", () => {
    expect(isValidXPostId("123a")).toBe(false);
    expect(isValidXPostId("123 ")).toBe(false);
    expect(isValidXPostId("../12")).toBe(false);
    expect(isValidXPostId("12.34")).toBe(false);
  });

  it("rejects the empty string", () => {
    expect(isValidXPostId("")).toBe(false);
  });

  it("rejects overlong strings", () => {
    expect(isValidXPostId("1".repeat(31))).toBe(false);
  });
});

describe("isOpfsSafePathSegment", () => {
  it("accepts alphanumeric / dash / underscore segments", () => {
    expect(isOpfsSafePathSegment("abc_123-XYZ")).toBe(true);
  });

  it("rejects path traversal segments", () => {
    expect(isOpfsSafePathSegment(".")).toBe(false);
    expect(isOpfsSafePathSegment("..")).toBe(false);
  });

  it("rejects empty and special characters", () => {
    expect(isOpfsSafePathSegment("")).toBe(false);
    expect(isOpfsSafePathSegment("foo/bar")).toBe(false);
    expect(isOpfsSafePathSegment("foo\\bar")).toBe(false);
    expect(isOpfsSafePathSegment("foo.bin")).toBe(false);
  });

  it("rejects non-string values", () => {
    expect(isOpfsSafePathSegment(123 as unknown)).toBe(false);
    expect(isOpfsSafePathSegment(null as unknown)).toBe(false);
  });
});
