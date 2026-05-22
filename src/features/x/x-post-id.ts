const X_POST_ID_PATTERN = /^[0-9]{1,30}$/;

export function isValidXPostId(value: unknown): value is string {
  return typeof value === "string" && X_POST_ID_PATTERN.test(value);
}

const OPFS_SAFE_SEGMENT_PATTERN = /^[A-Za-z0-9_-]+$/;

export function isOpfsSafePathSegment(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value !== "." &&
    value !== ".." &&
    OPFS_SAFE_SEGMENT_PATTERN.test(value)
  );
}
