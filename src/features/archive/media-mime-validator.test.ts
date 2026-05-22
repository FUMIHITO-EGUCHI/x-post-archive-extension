import { describe, expect, it } from "vitest";
import { isAllowedMediaMimeType } from "./media-mime-validator";

describe("isAllowedMediaMimeType", () => {
  it("accepts image/* for image media", () => {
    expect(isAllowedMediaMimeType("image", "image/jpeg")).toBe(true);
    expect(isAllowedMediaMimeType("image", "image/png")).toBe(true);
    expect(isAllowedMediaMimeType("image", "image/webp;charset=binary")).toBe(true);
  });

  it("accepts video/* for video media", () => {
    expect(isAllowedMediaMimeType("video", "video/mp4")).toBe(true);
    expect(isAllowedMediaMimeType("video", "video/webm")).toBe(true);
  });

  it("rejects mismatched media type vs mime", () => {
    expect(isAllowedMediaMimeType("image", "video/mp4")).toBe(false);
    expect(isAllowedMediaMimeType("video", "image/png")).toBe(false);
  });

  it("rejects non-media content types", () => {
    expect(isAllowedMediaMimeType("image", "text/html")).toBe(false);
    expect(isAllowedMediaMimeType("image", "application/javascript")).toBe(false);
    expect(isAllowedMediaMimeType("video", "application/octet-stream")).toBe(false);
  });

  it("rejects null / undefined / empty", () => {
    expect(isAllowedMediaMimeType("image", null)).toBe(false);
    expect(isAllowedMediaMimeType("image", undefined)).toBe(false);
    expect(isAllowedMediaMimeType("image", "")).toBe(false);
  });
});
