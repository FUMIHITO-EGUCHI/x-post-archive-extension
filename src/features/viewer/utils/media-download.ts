import type { ArchivePostRecord } from "../../../types/archive";
import { createLogger } from "../../logging/logger";
import { readBlobFromOpfs } from "../../media-storage/opfs-media-storage";

const logger = createLogger("viewer");
const MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/avif": "avif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov"
};

export async function resolveMediaExtension(mimeType: string | null, blob: Blob): Promise<string> {
  const mime = mimeType?.split(";")[0]?.trim().toLowerCase() ?? "";
  const extension = MIME_EXTENSIONS[mime];
  if (Object.hasOwn(MIME_EXTENSIONS, mime) && extension !== undefined) {
    return extension;
  }

  const bytes = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
  const startsWith = (...signature: number[]) =>
    signature.every((value, index) => bytes[index] === value);
  const text = (start: number, end: number) =>
    String.fromCharCode(...bytes.slice(start, end));

  if (startsWith(0xff, 0xd8, 0xff)) return "jpg";
  if (startsWith(0x89, 0x50, 0x4e, 0x47)) return "png";
  if (text(0, 4) === "GIF8") return "gif";
  if (text(0, 4) === "RIFF" && text(8, 12) === "WEBP") return "webp";
  if (text(4, 8) === "ftyp") {
    if (text(8, 12) === "avif" || text(8, 12) === "avis") return "avif";
    if (mime.startsWith("image/")) return "bin";
    return "mp4";
  }
  return "bin";
}

export function buildMediaDownloadFilename(
  username: string,
  xPostId: string,
  number: number,
  extension: string
): string {
  return `${username.replace(/[^A-Za-z0-9_]/g, "_")}_${xPostId}_${number}.${extension}`;
}

// Success means the browser was asked to download; browser policy may still block it.
export async function downloadPostMedia(
  post: Pick<ArchivePostRecord, "x_username" | "x_post_id" | "media">
): Promise<{ failedCount: number }> {
  const media = post.media
    .filter((item) => item.storage_status === "ready")
    .sort((a, b) => a.position - b.position);
  let failedCount = 0;

  for (const [index, item] of media.entries()) {
    try {
      const blob = await readBlobFromOpfs(item.opfs_path, item.mime_type);
      const extension = await resolveMediaExtension(item.mime_type, blob);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      try {
        anchor.href = url;
        anchor.download = buildMediaDownloadFilename(
          post.x_username, post.x_post_id, index + 1, extension
        );
        document.body.append(anchor);
        anchor.click();
      } finally {
        anchor.remove();
        // Keep large video URLs alive long enough for Chrome to start reading.
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      }
    } catch (error) {
      failedCount += 1;
      logger.error("media.download.failed", {
        context: { mediaId: item.media_id, xPostId: post.x_post_id, error }
      });
    }
  }

  return { failedCount };
}
