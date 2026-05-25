import { describe, expect, it } from "vitest";
import { isValidXPostId } from "./x-post-id";

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
