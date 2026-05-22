import { describe, expect, it } from "vitest";
import {
  isOpfsSafeSegment,
  isValidMediaOpfsPath
} from "./opfs-path-validation";

describe("isOpfsSafeSegment", () => {
  it("accepts alphanumeric / dash / underscore segments", () => {
    expect(isOpfsSafeSegment("abc_123-XYZ")).toBe(true);
  });

  it("rejects path traversal segments", () => {
    expect(isOpfsSafeSegment(".")).toBe(false);
    expect(isOpfsSafeSegment("..")).toBe(false);
    expect(isOpfsSafeSegment("../escape")).toBe(false);
  });

  it("rejects empty segments", () => {
    expect(isOpfsSafeSegment("")).toBe(false);
  });

  it("rejects segments with separators or special characters", () => {
    expect(isOpfsSafeSegment("foo/bar")).toBe(false);
    expect(isOpfsSafeSegment("foo\\bar")).toBe(false);
    expect(isOpfsSafeSegment("foo bar")).toBe(false);
    expect(isOpfsSafeSegment("foo.bin")).toBe(false);
  });
});

describe("isValidMediaOpfsPath", () => {
  it("accepts canonical image / video / preview paths", () => {
    expect(isValidMediaOpfsPath("/media/images/1234567890/abc-uuid.bin")).toBe(true);
    expect(isValidMediaOpfsPath("/media/videos/1234567890/abc-uuid.bin")).toBe(true);
    expect(isValidMediaOpfsPath("/media/video-previews/1234567890/abc-uuid.jpg")).toBe(true);
  });

  it("rejects paths outside of /media/", () => {
    expect(isValidMediaOpfsPath("/foo/bar.bin")).toBe(false);
    expect(isValidMediaOpfsPath("media/images/1/2.bin")).toBe(false);
  });

  it("rejects path traversal attempts", () => {
    expect(isValidMediaOpfsPath("/media/images/../escape/1.bin")).toBe(false);
    expect(isValidMediaOpfsPath("/media/images/1/../etc/passwd")).toBe(false);
  });

  it("rejects unknown extensions", () => {
    expect(isValidMediaOpfsPath("/media/images/1/abc.exe")).toBe(false);
    expect(isValidMediaOpfsPath("/media/images/1/abc")).toBe(false);
  });

  it("rejects unknown media category names", () => {
    expect(isValidMediaOpfsPath("/media/secrets/1/abc.bin")).toBe(false);
  });
});
