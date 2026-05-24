import type { MediaType } from "../../types/archive";
import { isOpfsSafeSegment } from "./opfs-path-validation";

const MEDIA_ROOT_SEGMENTS = ["media"] as const;

export function buildMediaOpfsPath(
  xPostId: string,
  mediaId: string,
  mediaType: MediaType
): string {
  requireSafeOpfsSegment(xPostId, "xPostId");
  requireSafeOpfsSegment(mediaId, "mediaId");
  return `/${[...MEDIA_ROOT_SEGMENTS, getMediaDirectory(mediaType), xPostId, `${mediaId}.bin`].join("/")}`;
}

export function buildVideoPreviewOpfsPath(xPostId: string, mediaId: string): string {
  requireSafeOpfsSegment(xPostId, "xPostId");
  requireSafeOpfsSegment(mediaId, "mediaId");
  return `/${[...MEDIA_ROOT_SEGMENTS, "video-previews", xPostId, `${mediaId}.jpg`].join("/")}`;
}

function requireSafeOpfsSegment(segment: string, field: string): void {
  if (!isOpfsSafeSegment(segment)) {
    throw new Error(`Unsafe OPFS path segment for ${field}.`);
  }
}

export type OpfsWriteResult = {
  checksum: string;
};

export async function writeBlobToOpfs(
  opfsPath: string,
  blob: Blob
): Promise<OpfsWriteResult> {
  const buffer = await blob.arrayBuffer();
  const checksum = await calculateSha256Hex(buffer);
  const fileHandle = await getFileHandle(opfsPath, true);
  const writable = await fileHandle.createWritable();

  try {
    await writable.write(buffer);
  } finally {
    await writable.close();
  }

  return {
    checksum
  };
}

export async function readBlobFromOpfs(opfsPath: string): Promise<Blob> {
  const fileHandle = await getFileHandle(opfsPath, false);
  const file = await fileHandle.getFile();
  return file;
}

export async function deleteBlobFromOpfs(opfsPath: string): Promise<void> {
  const segments = splitOpfsPath(opfsPath);
  const fileName = segments.at(-1);

  if (fileName === undefined) {
    throw new Error("Invalid OPFS path.");
  }

  const parentSegments = segments.slice(0, -1);
  const parentDirectory = await getDirectory(parentSegments, false);

  try {
    await parentDirectory.removeEntry(fileName);
  } catch (error) {
    if (isNotFoundError(error)) {
      return;
    }

    throw error;
  }

  await deleteDirectoryIfEmpty(parentSegments);
}

export async function clearMediaRootFromOpfs(): Promise<void> {
  const rootDirectory = await navigator.storage.getDirectory();

  try {
    await rootDirectory.removeEntry(MEDIA_ROOT_SEGMENTS[0], {
      recursive: true
    });
  } catch (error) {
    if (isNotFoundError(error)) {
      return;
    }

    throw error;
  }
}

async function getFileHandle(
  opfsPath: string,
  create: boolean
): Promise<FileSystemFileHandle> {
  const segments = splitOpfsPath(opfsPath);
  const fileName = segments.at(-1);

  if (fileName === undefined) {
    throw new Error("Invalid OPFS path.");
  }

  const directory = await getDirectory(segments.slice(0, -1), create);
  return directory.getFileHandle(fileName, {
    create
  });
}

async function getDirectory(
  segments: string[],
  create: boolean
): Promise<FileSystemDirectoryHandle> {
  let directory = await navigator.storage.getDirectory();

  for (const segment of segments) {
    directory = await directory.getDirectoryHandle(segment, {
      create
    });
  }

  return directory;
}

async function deleteDirectoryIfEmpty(segments: string[]): Promise<void> {
  for (let index = segments.length; index > MEDIA_ROOT_SEGMENTS.length; index -= 1) {
    const currentSegments = segments.slice(0, index);
    const currentName = currentSegments.at(-1);
    const parentSegments = currentSegments.slice(0, -1);

    if (currentName === undefined) {
      return;
    }

    const parentDirectory = await getDirectory(parentSegments, false);

    try {
      await parentDirectory.removeEntry(currentName);
    } catch (error) {
      if (isNotFoundError(error) || isDirectoryNotEmptyError(error)) {
        return;
      }

      throw error;
    }
  }
}

function splitOpfsPath(opfsPath: string): string[] {
  const normalized = opfsPath.trim();

  if (!normalized.startsWith("/")) {
    throw new Error("OPFS path must start with '/'.");
  }

  const rawSegments = normalized.split("/");

  for (const segment of rawSegments) {
    if (segment === ".." || segment === ".") {
      throw new Error("OPFS path contains an unsafe segment.");
    }
  }

  const segments = rawSegments.filter((segment) => segment.length > 0);

  if (segments.length <= MEDIA_ROOT_SEGMENTS.length) {
    throw new Error("OPFS path is missing file segments.");
  }

  if (segments[0] !== MEDIA_ROOT_SEGMENTS[0]) {
    throw new Error("OPFS path must start under the media root.");
  }

  for (const segment of segments) {
    const lastSeparator = segment.lastIndexOf(".");
    const base = lastSeparator > 0 ? segment.slice(0, lastSeparator) : segment;
    const extension = lastSeparator > 0 ? segment.slice(lastSeparator + 1) : "";

    if (!/^[A-Za-z0-9_-]+$/.test(base)) {
      throw new Error("OPFS path contains an unsafe segment.");
    }

    if (extension !== "" && !/^[A-Za-z0-9]+$/.test(extension)) {
      throw new Error("OPFS path contains an unsafe segment.");
    }
  }

  return segments;
}

function getMediaDirectory(mediaType: MediaType): string {
  switch (mediaType) {
    case "image":
      return "images";
    case "video":
      return "videos";
  }
}

function isDirectoryNotEmptyError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "InvalidModificationError";
}

function isNotFoundError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "NotFoundError";
}

export function isQuotaExceededError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === "QuotaExceededError" || error.code === DOMException.QUOTA_EXCEEDED_ERR)
  );
}

async function calculateSha256Hex(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(hashBuffer)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}
