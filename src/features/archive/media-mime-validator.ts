import type { MediaType } from "../../types/archive";

export function isAllowedMediaMimeType(
  mediaType: MediaType,
  mimeType: string | null | undefined
): boolean {
  if (typeof mimeType !== "string") {
    return false;
  }

  const normalized = mimeType.toLowerCase().split(";")[0]?.trim();

  if (normalized === undefined || normalized === "") {
    return false;
  }

  if (mediaType === "image") {
    return normalized.startsWith("image/");
  }

  return normalized.startsWith("video/");
}
