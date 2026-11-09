import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MediaRecord } from "../../../types/archive";
import { readBlobFromOpfs } from "../../media-storage/opfs-media-storage";
import { buildMediaDownloadFilename, downloadPostMedia, resolveMediaExtension } from "./media-download";

const { logError } = vi.hoisted(() => ({ logError: vi.fn() }));
vi.mock("../../logging/logger", () => ({ createLogger: () => ({ error: logError }) }));
vi.mock("../../media-storage/opfs-media-storage", () => ({ readBlobFromOpfs: vi.fn() }));

const media = (overrides: Partial<MediaRecord> = {}): MediaRecord => ({
  media_id: "image", x_post_id: "123", media_type: "image",
  source_url: "https://pbs.twimg.com/media/image.jpg", preview_image_url: null,
  preview_image_opfs_path: null, opfs_path: "/media/images/123/image.bin", position: 0,
  alt_text: null, width: null, height: null, mime_type: "image/jpeg", byte_size: null,
  checksum: null, storage_status: "ready", saved_at: 0, last_error: null, ...overrides
});

describe("resolveMediaExtension", () => {
  it.each([
    [" IMAGE/JPEG ; charset=binary", "jpg"], ["image/png", "png"],
    ["image/gif", "gif"], ["image/webp", "webp"], ["image/avif", "avif"], ["video/mp4", "mp4"],
    ["video/webm; codecs=vp9", "webm"], ["video/quicktime", "mov"]
  ])("prefers saved MIME %s over conflicting bytes", async (mime, extension) => {
    expect(await resolveMediaExtension(mime, new Blob(["GIF89a"]))).toBe(extension);
  });

  it.each([
    [[0xff, 0xd8, 0xff], "jpg"], [[0x89, 0x50, 0x4e, 0x47], "png"],
    [[0x47, 0x49, 0x46, 0x38], "gif"],
    [[0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50], "webp"],
    [[0, 0, 0, 32, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66], "avif"],
    [[0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0, 0, 0, 0], "mp4"]
  ] as const)("sniffs %j when MIME is absent or unmapped", async (bytes, extension) => {
    for (const mime of [null, "", "application/octet-stream", "unknown/type"]) {
      expect(await resolveMediaExtension(mime, new Blob([new Uint8Array(bytes)]))).toBe(extension);
    }
  });

  it("does not identify an unsupported image in an ftyp container as MP4", async () => {
    const heic = new Blob([new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63])]);
    expect(await resolveMediaExtension("image/heic", heic)).toBe("bin");
  });

  it.each([[], [0xff, 0xd8], [0x52, 0x49, 0x46, 0x46], [1, 2, 3]])(
    "falls back for unknown or truncated bytes %j", async (...bytes) => {
      expect(await resolveMediaExtension(null, new Blob([new Uint8Array(bytes)]))).toBe("bin");
    }
  );
});

it("builds the required filename and replaces unsafe username characters", () => {
  expect(buildMediaDownloadFilename("User_name9", "123", 1, "jpg")).toBe("User_name9_123_1.jpg");
  expect(buildMediaDownloadFilename("../a@名", "456", 4, "mp4")).toBe("___a___456_4.mp4");
});

describe("downloadPostMedia", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(readBlobFromOpfs).mockReset().mockResolvedValue(new Blob(["image"]));
    logError.mockClear();
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:download");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("downloads ready media sequentially in position order, using the video body only", async () => {
    const filenames: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.isConnected).toBe(true);
      filenames.push(this.download);
    });
    const video = media({ media_id: "video", position: 2, media_type: "video",
      mime_type: "video/mp4", opfs_path: "/media/videos/123/video.bin",
      preview_image_opfs_path: "/media/video-previews/123/video.jpg" });
    const items = [video, media({ storage_status: "failed" }), media(),
      media({ storage_status: "pending" })];
    expect(await downloadPostMedia({ x_username: "author", x_post_id: "123", media: items }))
      .toEqual({ failedCount: 0 });
    expect(filenames).toEqual(["author_123_1.jpg", "author_123_2.mp4"]);
    expect(vi.mocked(readBlobFromOpfs).mock.calls).toEqual([
      ["/media/images/123/image.bin", "image/jpeg"], [video.opfs_path, "video/mp4"]
    ]);
    expect(items[0]).toBe(video);
    expect(document.querySelector("a[download]")).toBeNull();
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(59_999);
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
  });

  it("continues after a read failure, preserves numbering, and logs context", async () => {
    const error = new Error("Missing file");
    vi.mocked(readBlobFromOpfs).mockRejectedValueOnce(error);
    const filenames: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      filenames.push(this.download);
    });
    expect(await downloadPostMedia({ x_username: "quoted", x_post_id: "789",
      media: [media(), media({ media_id: "second", position: 1 })] }))
      .toEqual({ failedCount: 1 });
    expect(filenames).toEqual(["quoted_789_2.jpg"]);
    expect(logError).toHaveBeenCalledWith("media.download.failed", {
      context: { mediaId: "image", xPostId: "789", error }
    });
  });

  it("cleans up and continues when triggering a download throws", async () => {
    vi.spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementationOnce(() => { throw new Error("click failed"); })
      .mockImplementation(() => {});
    expect(await downloadPostMedia({ x_username: "a", x_post_id: "123",
      media: [media(), media({ position: 1 })] })).toEqual({ failedCount: 1 });
    expect(document.querySelector("a[download]")).toBeNull();
    vi.advanceTimersByTime(60_000);
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
  });
});
