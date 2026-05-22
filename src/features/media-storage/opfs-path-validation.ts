const MEDIA_OPFS_PATH_PATTERN =
  /^\/media\/(images|videos|video-previews)\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\.(?:bin|jpg)$/;

const OPFS_SAFE_SEGMENT_PATTERN = /^[A-Za-z0-9_-]+$/;

export function isOpfsSafeSegment(segment: string): boolean {
  if (segment.length === 0 || segment === "." || segment === "..") {
    return false;
  }

  return OPFS_SAFE_SEGMENT_PATTERN.test(segment);
}

export function isValidMediaOpfsPath(path: string): boolean {
  if (typeof path !== "string") {
    return false;
  }

  return MEDIA_OPFS_PATH_PATTERN.test(path);
}
