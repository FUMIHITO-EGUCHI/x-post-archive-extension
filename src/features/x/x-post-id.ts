const X_POST_ID_PATTERN = /^[0-9]{1,30}$/;

export function isValidXPostId(value: unknown): value is string {
  return typeof value === "string" && X_POST_ID_PATTERN.test(value);
}
