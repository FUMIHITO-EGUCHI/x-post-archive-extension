import type { RuntimeMessage } from "../../types/runtime";
import { isValidXPostId } from "../x/x-post-id";

const MAX_TAG_DISPLAY_NAME_LENGTH = 200;
const MAX_TAG_ID_LENGTH = 200;
const MAX_TRACE_ID_LENGTH = 200;
const MAX_BATCH_POST_COUNT = 5000;
const MAX_BULK_POST_ID_COUNT = 5000;

export function validateRuntimeMessage(message: RuntimeMessage): {
  ok: true;
} | {
  ok: false;
  reason: string;
} {
  switch (message.type) {
    case "posts/save":
      return validatePostInput(message.post.x_post_id, "post.x_post_id");

    case "posts/save-batch":
    case "posts/save-thread":
      return validatePostBatch(message.posts);

    case "posts/has":
    case "posts/delete":
      return validatePostId(message.xPostId);

    case "posts/thread/get":
      return validatePostId(message.rootId);

    case "refetch.complete":
      return validatePostId(message.xPostId);

    case "post_tag.add":
      return validatePostIdAnd(
        message.postId,
        () => validateBoundedString(message.displayName, MAX_TAG_DISPLAY_NAME_LENGTH, "displayName")
      );

    case "post_tag.remove":
      return validatePostIdAnd(
        message.postId,
        () => validateBoundedString(message.normalizedName, MAX_TAG_DISPLAY_NAME_LENGTH, "normalizedName")
      );

    case "tag.rename":
      return combine(
        validateBoundedString(message.tagId, MAX_TAG_ID_LENGTH, "tagId"),
        validateBoundedString(message.newDisplayName, MAX_TAG_DISPLAY_NAME_LENGTH, "newDisplayName")
      );

    case "tag.merge":
      return combine(
        validateBoundedString(message.sourceTagId, MAX_TAG_ID_LENGTH, "sourceTagId"),
        validateBoundedString(message.targetTagId, MAX_TAG_ID_LENGTH, "targetTagId")
      );

    case "tag.redirects.delete":
      return validateBoundedString(message.tagRedirectId, MAX_TAG_ID_LENGTH, "tagRedirectId");

    case "tag.bulk-assign.preview":
      return validateBoundedString(message.targetTagName, MAX_TAG_DISPLAY_NAME_LENGTH, "targetTagName");

    case "tag.bulk-assign.apply-batch":
      return validateBulkApply(message.postIds, message.targetTagId, message.targetNormalizedName, message.targetDisplayName);

    case "refetch.enqueue":
      return validateRefetchEnqueue(message.xPostIds);

    case "tweet-detail-template/set":
      return validateTweetDetailTemplate(message.template.url, message.sessionAuth);

    case "debug/log":
      if (typeof message.traceId === "string" && message.traceId.length > MAX_TRACE_ID_LENGTH) {
        return reject("debug.traceId exceeds maximum length.");
      }
      return { ok: true };

    case "posts/list-page":
    case "posts/tags/list":
    case "users/summaries":
    case "posts/summary":
    case "tag.redirects.list":
    case "refetch.status":
    case "refetch.cancel":
    case "refetch.clear":
    case "archive/reset":
    case "logs/clear":
    case "thread-expand/auth-stale-check":
      return { ok: true };
  }
}

function validatePostId(value: unknown): { ok: true } | { ok: false; reason: string } {
  return isValidXPostId(value) ? { ok: true } : reject("xPostId is not a valid X post identifier.");
}

function validatePostInput(value: unknown, field: string): { ok: true } | { ok: false; reason: string } {
  return isValidXPostId(value)
    ? { ok: true }
    : reject(`${field} is not a valid X post identifier.`);
}

function validatePostBatch(posts: ReadonlyArray<{ x_post_id: string }>):
  | { ok: true }
  | { ok: false; reason: string } {
  if (!Array.isArray(posts)) {
    return reject("posts must be an array.");
  }

  if (posts.length > MAX_BATCH_POST_COUNT) {
    return reject(`posts exceeds maximum batch count of ${MAX_BATCH_POST_COUNT}.`);
  }

  for (const post of posts) {
    if (post === null || typeof post !== "object") {
      return reject("posts contains an invalid entry.");
    }

    const identifier = (post as { x_post_id?: unknown }).x_post_id;

    if (!isValidXPostId(identifier)) {
      return reject("posts contains an invalid x_post_id.");
    }
  }

  return { ok: true };
}

function validatePostIdAnd(
  postId: unknown,
  next: () => { ok: true } | { ok: false; reason: string }
): { ok: true } | { ok: false; reason: string } {
  if (!isValidXPostId(postId)) {
    return reject("postId is not a valid X post identifier.");
  }

  return next();
}

function validateBoundedString(
  value: unknown,
  maxLength: number,
  field: string
): { ok: true } | { ok: false; reason: string } {
  if (typeof value !== "string") {
    return reject(`${field} must be a string.`);
  }

  if (value.length === 0) {
    return reject(`${field} must not be empty.`);
  }

  if (value.length > maxLength) {
    return reject(`${field} exceeds maximum length of ${maxLength}.`);
  }

  return { ok: true };
}

function validateBulkApply(
  postIds: unknown,
  targetTagId: unknown,
  targetNormalizedName: unknown,
  targetDisplayName: unknown
): { ok: true } | { ok: false; reason: string } {
  if (!Array.isArray(postIds)) {
    return reject("postIds must be an array.");
  }

  if (postIds.length > MAX_BULK_POST_ID_COUNT) {
    return reject(`postIds exceeds maximum count of ${MAX_BULK_POST_ID_COUNT}.`);
  }

  for (const id of postIds) {
    if (!isValidXPostId(id)) {
      return reject("postIds contains an invalid xPostId.");
    }
  }

  return combine(
    validateBoundedString(targetTagId, MAX_TAG_ID_LENGTH, "targetTagId"),
    validateBoundedString(targetNormalizedName, MAX_TAG_DISPLAY_NAME_LENGTH, "targetNormalizedName"),
    validateBoundedString(targetDisplayName, MAX_TAG_DISPLAY_NAME_LENGTH, "targetDisplayName")
  );
}

function validateRefetchEnqueue(xPostIds: unknown):
  | { ok: true }
  | { ok: false; reason: string } {
  if (xPostIds === undefined) {
    return { ok: true };
  }

  if (!Array.isArray(xPostIds)) {
    return reject("xPostIds must be an array.");
  }

  for (const id of xPostIds) {
    if (!isValidXPostId(id)) {
      return reject("xPostIds contains an invalid xPostId.");
    }
  }

  return { ok: true };
}

function validateTweetDetailTemplate(
  url: unknown,
  sessionAuth: unknown
): { ok: true } | { ok: false; reason: string } {
  if (typeof url !== "string") {
    return reject("template.url must be a string.");
  }

  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    return reject("template.url is not a valid URL.");
  }

  if (parsed.protocol !== "https:") {
    return reject("template.url must use https.");
  }

  if (parsed.hostname !== "x.com" && parsed.hostname !== "twitter.com") {
    return reject("template.url host is not allowed.");
  }

  if (sessionAuth === null || typeof sessionAuth !== "object" || Array.isArray(sessionAuth)) {
    return reject("sessionAuth must be an object.");
  }

  return { ok: true };
}

function combine(
  ...results: ({ ok: true } | { ok: false; reason: string })[]
): { ok: true } | { ok: false; reason: string } {
  for (const result of results) {
    if (!result.ok) {
      return result;
    }
  }

  return { ok: true };
}

function reject(reason: string): { ok: false; reason: string } {
  return { ok: false, reason };
}
