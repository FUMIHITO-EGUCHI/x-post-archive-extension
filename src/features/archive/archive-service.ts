import { archiveDb } from "../../db/archive-database";
import {
  addMediaRecords,
  countMediaByType,
  listMediaByStorageStatus,
  deleteMediaRecordsByPostId,
  listMediaByPostId,
  listMediaByPostIds,
  markMediaPending,
  sumMediaByteSize,
  updateMediaAfterWrite,
  updateMediaPreview
} from "../../db/repositories/media-repository";
import { enqueueThreadExpand } from "../../db/repositories/thread-repository";
import {
  addPost,
  countThreadPostsByRoots,
  countPostsByUsername,
  countPosts,
  deletePostRecord,
  getPost,
  getLatestPostByUsername,
  getThread,
  listPostIds,
  listPostIdsByKeyword,
  listPostIdsByUsername,
  listPostUsernames,
  listRootOrSinglePostIds,
  getPostsByIds,
  hasPost,
  buildPostPageCursor,
  listPostsSliceBySort,
  updatePostFields
} from "../../db/repositories/posts-repository";
import {
  addPostTag,
  bulkAddPostTagRecords,
  countAssignedTagNames,
  countPostTagLinksByTagId,
  deletePostTag,
  deletePostTagsByPostId,
  getPostTagByNormalizedName,
  listAllPostTags,
  listPostIdsByTagId,
  listPostIdsByNormalizedName,
  listPostTagsByTagId,
  listPostTagsByPostId,
  listPostTagsByPostIds
} from "../../db/repositories/post-tags-repository";
import {
  deleteTagRedirectById,
  getTagRedirectBySourceNormalizedName,
  listTagRedirects,
  listTagRedirectsByTargetTagId,
  putTagRedirect
} from "../../db/repositories/tag-redirects-repository";
import {
  addTag,
  deleteTagsByIds,
  getTagById,
  getTagByNormalizedName,
  updateTag
} from "../../db/repositories/tags-repository";
import { resolveKnownBuiltInTagKey } from "../settings/archive-language";
import type {
  ArchivePostRecord,
  ArchiveTagRecord,
  BuiltInTagKey,
  MediaRecord,
  PostRecord,
  PostTagRecord,
  SaveImageInput,
  SavePostInput,
  SaveVideoCandidateInput,
  TagRecord,
  TagRedirectRecord,
  TagSource
} from "../../types/archive";
import type {
  ArchiveTagRedirectSummaryRecord,
  ArchiveSummaryRecord,
  ArchiveTagSummaryRecord,
  DateFilterTarget,
  ListPostsPageInput,
  PostPageCursor,
  PostFilterInput,
  ThreadedPostRecord,
  UserSummary
} from "../../types/viewer";
import {
  buildMediaOpfsPath,
  buildVideoPreviewOpfsPath,
  deleteBlobFromOpfs,
  isQuotaExceededError,
  writeBlobToOpfs
} from "../media-storage/opfs-media-storage";
import { createLogger } from "../logging/logger";
import { canonicalizeTwitterImageUrl } from "../x/twitter-image-url";
import { isAllowedMediaMimeType } from "./media-mime-validator";

const PENDING_MEDIA_RESUME_BATCH_SIZE = 24;
const MEDIA_PERSISTENCE_IDLE_WAIT_MS = 100;
const MEDIA_PERSISTENCE_IDLE_MAX_WAIT_MS = 30000;
const activeMediaPersistenceIds = new Set<string>();
let pendingResumePromise: Promise<void> | null = null;
const logger = createLogger("archive-service");

export async function hasSavedPost(xPostId: string): Promise<boolean> {
  return hasPost(xPostId);
}

export async function saveArchivePost(input: SavePostInput): Promise<{
  status: "saved" | "duplicate";
  post?: PostRecord;
}>;
export async function saveArchivePost(
  input: SavePostInput,
  options?: {
    traceId?: string;
    enqueueThreadExpand?: boolean;
  }
): Promise<{
  status: "saved" | "duplicate";
  post?: PostRecord;
}>;
export async function saveArchivePost(
  input: SavePostInput,
  options: {
    traceId?: string;
    enqueueThreadExpand?: boolean;
  } = {}
): Promise<{
  status: "saved" | "duplicate";
  post?: PostRecord;
}> {
  validateSavePostInput(input);

  const autoTags = buildAutoTagRecords(
    input.x_post_id,
    input.post_text,
    input.auto_tags ?? [],
    Date.now()
  );
  const existing = await getPost(input.x_post_id);
  const normalizedQuotedPostId = normalizeOptionalPostId(input.quoted_post_id);
  const normalizedInReplyToPostId = normalizeOptionalPostId(input.in_reply_to_post_id);
  const normalizedThreadRootId = normalizeOptionalPostId(input.thread_root_id);

  if (existing !== undefined) {
    const duplicateMediaWork = await prepareDuplicateMediaWork(input);
    const updatedFields = buildDuplicatePostFieldUpdate(existing, {
      quoted_post_id: normalizedQuotedPostId,
      in_reply_to_post_id: normalizedInReplyToPostId,
      thread_root_id: normalizedThreadRootId
    });

    logger.info("post.save.duplicate_detected", {
      context: {
        xPostId: input.x_post_id,
        newMediaCount: duplicateMediaWork.newRecords.length,
        retryMediaCount: duplicateMediaWork.retryRecords.length,
        traceId: options.traceId ?? null
      }
    });

    if (duplicateMediaWork.newRecords.length > 0 || duplicateMediaWork.retryRecords.length > 0) {
      if (duplicateMediaWork.newRecords.length > 0) {
        await addMediaRecords(duplicateMediaWork.newRecords);
      }

      for (const media of duplicateMediaWork.retryRecords) {
        await markMediaPending(media.media_id);
      }
    }

    if (Object.keys(updatedFields).length > 0) {
      await updatePostFields(input.x_post_id, updatedFields);
    }

    try {
      await assignAutoTags(input.x_post_id, autoTags);
    } catch (error) {
      throw new Error(`Post save failed while assigning duplicate auto tags: ${formatError(error)}`);
    }

    if (duplicateMediaWork.persistRecords.length > 0) {
      enqueueMediaPersistence(duplicateMediaWork.persistRecords, options.traceId);
    }

    await enqueueThreadExpandIfCandidate(input, {
      traceId: options.traceId,
      enabled: options.enqueueThreadExpand !== false,
      normalizedInReplyToPostId,
      normalizedThreadRootId
    });

    return {
      status: "duplicate",
      post: Object.keys(updatedFields).length > 0 ? { ...existing, ...updatedFields } : existing
    };
  }

  const savedAt = Date.now();
  const post: PostRecord = {
    x_post_id: input.x_post_id,
    display_name: input.display_name.trim(),
    x_username: input.x_username.trim(),
    post_text: input.post_text.trim(),
    post_url: input.post_url.trim(),
    posted_at: input.posted_at,
    reply_count: input.reply_count,
    repost_count: input.repost_count,
    like_count: input.like_count,
    in_reply_to_post_id: normalizedInReplyToPostId,
    thread_root_id: normalizedThreadRootId,
    quoted_post_id: normalizedQuotedPostId,
    saved_at: savedAt
  };
  const imageMedia = input.media.map((image) =>
    createPendingImageRecord(input.x_post_id, image, savedAt)
  );
  const videoMedia = (input.video_candidates ?? [])
    .filter((candidate) => candidate.download_mode === "direct_mp4")
    .map((candidate, index) =>
      createPendingVideoRecord(input.x_post_id, candidate, savedAt, imageMedia.length + index)
    );
  const media = [...imageMedia, ...videoMedia];

  try {
    await archiveDb.transaction(
      "rw",
      archiveDb.posts,
      archiveDb.media,
      archiveDb.tags,
      archiveDb.post_tags,
      async () => {
        await addPost(post);
        await addMediaRecords(media);
        await assignAutoTags(input.x_post_id, autoTags);
      }
    );
  } catch (error) {
    throw new Error(`Post save failed in create transaction: ${formatError(error)}`);
  }

  enqueueMediaPersistence(media, options.traceId);

  logger.info("post.save.persisted", {
    context: {
      xPostId: post.x_post_id,
      mediaCount: media.length,
      autoTagCount: autoTags.length,
      traceId: options.traceId ?? null
    }
  });

  await enqueueThreadExpandIfCandidate(input, {
    traceId: options.traceId,
    enabled: options.enqueueThreadExpand !== false,
    normalizedInReplyToPostId,
    normalizedThreadRootId
  });

  return {
    status: "saved",
    post
  };
}

export async function saveThread(
  posts: SavePostInput[],
  options: {
    traceId?: string;
    enqueueThreadExpand?: boolean;
  } = {}
): Promise<{
  saved: number;
  skipped: number;
  failed: number;
  threadRootId: string | null;
}> {
  if (posts.length === 0) {
    return {
      saved: 0,
      skipped: 0,
      failed: 0,
      threadRootId: null
    };
  }

  const threadRootId = posts.length > 1 ? posts[0]?.x_post_id ?? null : null;
  let saved = 0;
  let skipped = 0;
  let failed = 0;

  for (const [index, post] of posts.entries()) {
    const normalizedPost: SavePostInput = {
      ...post,
      in_reply_to_post_id:
        threadRootId === null ? null : index === 0 ? null : posts[index - 1]?.x_post_id ?? null,
      thread_root_id: threadRootId
    };

    try {
      const result = await saveArchivePost(normalizedPost, options);

      if (result.status === "saved") {
        saved += 1;
      } else {
        skipped += 1;
      }
    } catch (error) {
      failed += 1;
      logger.warn("thread.save.post_failed", {
        context: {
          xPostId: post.x_post_id,
          threadRootId,
          traceId: options.traceId ?? null,
          error: formatError(error)
        }
      });
    }
  }

  return {
    saved,
    skipped,
    failed,
    threadRootId
  };
}

export async function listArchivePostsPage(
  input: ListPostsPageInput
): Promise<{
  posts: ArchivePostRecord[];
  totalCount: number;
  hasMore: boolean;
  nextOffset: number;
  nextCursor: PostPageCursor | null;
}> {
  const normalizedOffset = normalizePageOffset(input.offset);
  const normalizedLimit = normalizePageLimit(input.limit);
  const matchingPostIds = await resolveFilteredPostIds(input);
  const visiblePostIds = await resolveViewerListPostIds(matchingPostIds);
  const totalCount = visiblePostIds.size;

  if (totalCount === 0) {
    return {
      posts: [],
      totalCount: 0,
      hasMore: false,
      nextOffset: normalizedOffset,
      nextCursor: null
    };
  }

  const pageResult =
    input.sortField === "random"
      ? {
          posts: await listRandomPostsPage(
            visiblePostIds,
            normalizedOffset,
            normalizedLimit,
            normalizeRandomSeed(input.randomSeed)
          ),
          nextCursor: null as PostPageCursor | null
        }
      : await listFilteredPostsPage(
          input,
          visiblePostIds,
          normalizedOffset,
          normalizedLimit,
          resolveKeysetCursor(input)
        );

  return {
    posts: await hydrateArchivePosts(pageResult.posts),
    totalCount,
    hasMore: normalizedOffset + pageResult.posts.length < totalCount,
    nextOffset: normalizedOffset + pageResult.posts.length,
    nextCursor: pageResult.nextCursor
  };
}

function resolveKeysetCursor(input: ListPostsPageInput): PostPageCursor | null {
  // Why: a stale cursor from a different sort/direction would index into the wrong compound index
  // and silently return mis-ordered results. Drop it on mismatch — the caller falls back to offset.
  const cursor = input.cursor ?? null;

  if (cursor === null || input.sortField === "random") {
    return null;
  }

  if (cursor.sortField !== input.sortField || cursor.sortDirection !== input.sortDirection) {
    return null;
  }

  return cursor;
}

export async function hydrateThreadTree(rootId: string): Promise<ThreadedPostRecord | null> {
  const posts = await getThread(rootId);

  if (posts.length === 0) {
    return null;
  }

  const hydratedPosts = await hydrateArchivePosts(posts);
  return buildThreadedPostTree(rootId, hydratedPosts);
}

export async function listArchiveTagSummaries(): Promise<ArchiveTagSummaryRecord[]> {
  const postTags = await listAllPostTags();
  const summaryMap = new Map<
    string,
    {
      tag: ArchiveTagRecord;
      postIds: Set<string>;
    }
  >();

  for (const record of postTags) {
    const normalized = normalizeArchiveTag(record);
    const existing = summaryMap.get(normalized.tag.normalized_name);

    if (existing === undefined) {
      summaryMap.set(normalized.tag.normalized_name, {
        tag: normalized.tag,
        postIds: new Set([normalized.x_post_id])
      });
      continue;
    }

    if (existing.tag.source !== "manual" && normalized.tag.source === "manual") {
      existing.tag = normalized.tag;
    }

    existing.postIds.add(normalized.x_post_id);
  }

  return [...summaryMap.values()].map((entry) => ({
    tag: entry.tag,
    postCount: entry.postIds.size
  }));
}

export async function listArchiveUserSummaries(): Promise<UserSummary[]> {
  const usernames = await listPostUsernames();
  const summaryMap = new Map<
    string,
    {
      display_name: string;
      screen_name: string;
      post_count: number;
      latest_saved_at: number;
    }
  >();

  const summaries = await Promise.all(
    usernames.map(async (username) => {
      const normalizedScreenName = normalizeAuthorFilter(username);

      if (normalizedScreenName === null) {
        return null;
      }

      const [postCount, latestPost] = await Promise.all([
        countPostsByUsername(username),
        getLatestPostByUsername(username)
      ]);

      return {
        displayName: latestPost?.display_name ?? username,
        latestSavedAt: latestPost?.saved_at ?? 0,
        postCount,
        screenName: normalizedScreenName
      };
    })
  );

  for (const summary of summaries) {
    if (summary === null || summary.postCount === 0) {
      continue;
    }

    const existing = summaryMap.get(summary.screenName);

    if (existing === undefined) {
      summaryMap.set(summary.screenName, {
        display_name: summary.displayName,
        latest_saved_at: summary.latestSavedAt,
        post_count: summary.postCount,
        screen_name: summary.screenName
      });
      continue;
    }

    existing.post_count += summary.postCount;

    if (summary.latestSavedAt > existing.latest_saved_at) {
      summaryMap.set(summary.screenName, {
        display_name: summary.displayName,
        latest_saved_at: summary.latestSavedAt,
        post_count: existing.post_count,
        screen_name: summary.screenName
      });
    }
  }

  return [...summaryMap.values()].sort((left, right) => {
    const postCountDifference = right.post_count - left.post_count;

    if (postCountDifference !== 0) {
      return postCountDifference;
    }

    return left.screen_name.localeCompare(right.screen_name, "en-US");
  });
}

export async function listArchiveTagRedirectSummaries(): Promise<ArchiveTagRedirectSummaryRecord[]> {
  const redirects = await listTagRedirects();

  if (redirects.length === 0) {
    return [];
  }

  const targetTagEntries = await Promise.all(
    [...new Set(redirects.map((item) => item.target_tag_id))].map(async (tagId) => [
      tagId,
      await getTagById(tagId)
    ] as const)
  );
  const targetTagMap = new Map(targetTagEntries);

  return redirects
    .map((redirect) => {
      const targetTag = targetTagMap.get(redirect.target_tag_id) ?? null;

      return {
        tag_redirect_id: redirect.tag_redirect_id,
        source_normalized_name: redirect.source_normalized_name,
        source_display_name: redirect.source_display_name,
        target_tag_id: redirect.target_tag_id,
        target_normalized_name: targetTag?.normalized_name ?? null,
        target_display_name: targetTag?.display_name ?? null,
        created_at: redirect.created_at
      };
    })
    .sort((left, right) =>
      left.source_display_name.localeCompare(right.source_display_name, "ja-JP")
    );
}

export async function deleteArchiveTagRedirect(tagRedirectId: string): Promise<boolean> {
  const existing = await archiveDb.tag_redirects.get(tagRedirectId);

  if (existing === undefined) {
    return false;
  }

  await archiveDb.transaction("rw", archiveDb.tag_redirects, async () => {
    await deleteTagRedirectById(tagRedirectId);
  });

  logger.info("tags.redirects.delete.completed", {
    context: {
      tagRedirectId,
      sourceNormalizedName: existing.source_normalized_name,
      targetTagId: existing.target_tag_id
    }
  });

  return true;
}

export async function getArchiveSummary(): Promise<ArchiveSummaryRecord> {
  const [postCount, imageCount, videoCount, mediaBytes, usernames, tagCount] = await Promise.all([
    countPosts(),
    countMediaByType("image"),
    countMediaByType("video"),
    sumMediaByteSize(),
    listPostUsernames(),
    countAssignedTagNames()
  ]);

  return {
    postCount,
    imageCount,
    videoCount,
    mediaCount: imageCount + videoCount,
    accountCount: usernames.length,
    tagCount,
    mediaBytes
  };
}

export async function addPostTagByName(
  postId: string,
  displayName: string
): Promise<
  | {
      ok: true;
      postTag: PostTagRecord;
    }
  | {
      ok: false;
      error: string;
    }
> {
  const post = await getPost(postId);

  if (post === undefined) {
    return {
      ok: false,
      error: "post-not-found"
    };
  }

  const normalizedName = normalizeTagName(displayName);

  if (normalizedName === null) {
    return {
      ok: false,
      error: "empty-name"
    };
  }

  const cleanedDisplayName = cleanupTagName(displayName);
  return archiveDb.transaction<
    | {
        ok: true;
        postTag: PostTagRecord;
      }
    | {
        ok: false;
        error: string;
      }
  >("rw", archiveDb.tags, archiveDb.post_tags, async () => {
    let tag = await getTagByNormalizedName(normalizedName);

    if (tag === undefined) {
      tag = {
        tag_id: crypto.randomUUID(),
        normalized_name: normalizedName,
        display_name: cleanedDisplayName,
        system_key: null,
        created_at: Date.now()
      };
      await addTag(tag);
    }

    const existingPostTag = await getPostTagByNormalizedName(postId, normalizedName);

    if (existingPostTag !== undefined) {
      return {
        ok: true,
        postTag: existingPostTag
      };
    }

    const postTag: PostTagRecord = {
      post_tag_id: crypto.randomUUID(),
      x_post_id: postId,
      tag_id: tag.tag_id,
      normalized_name: tag.normalized_name,
      display_name: tag.display_name,
      system_key: tag.system_key,
      source: "manual",
      assigned_at: Date.now()
    };

    await addPostTag(postTag);

    return {
      ok: true,
      postTag
    };
  });
}

export async function removePostTagByName(
  postId: string,
  normalizedName: string
): Promise<
  | {
      ok: true;
    }
  | {
      ok: false;
      error: string;
    }
> {
  const resolvedNormalizedName = normalizeTagName(normalizedName);

  if (resolvedNormalizedName === null) {
    return {
      ok: false,
      error: "invalid-name"
    };
  }

  const record = await getPostTagByNormalizedName(postId, resolvedNormalizedName);

  if (record === undefined) {
    return {
      ok: false,
      error: "not-found"
    };
  }

  if (record.source !== "manual") {
    return {
      ok: false,
      error: "not-removable"
    };
  }

  await archiveDb.transaction("rw", archiveDb.tags, archiveDb.post_tags, async () => {
    await deletePostTag(record.post_tag_id);
    await deleteOrphanedTag(record.tag_id);
  });

  return {
    ok: true
  };
}

export async function renameTag(
  tagId: string,
  newDisplayName: string
): Promise<
  | {
      ok: true;
      tag: TagRecord;
    }
  | {
      ok: false;
      error: "collision";
      conflictingTagId: string;
    }
> {
  const normalizedName = normalizeTagName(newDisplayName);

  if (normalizedName === null) {
    throw new Error("Invalid tag name.");
  }

  const displayName = cleanupTagName(newDisplayName);
  let previousNormalizedName: string | null = null;
  const result = await archiveDb.transaction<
    | {
        ok: true;
        tag: TagRecord;
      }
    | {
        ok: false;
        error: "collision";
        conflictingTagId: string;
      }
  >(
    "rw",
    archiveDb.tags,
    archiveDb.tag_redirects,
    archiveDb.post_tags,
    async () => {
      const currentTag = await getTagById(tagId);

      if (currentTag === undefined) {
        throw new Error("Tag not found.");
      }

      previousNormalizedName = currentTag.normalized_name;

      if (normalizedName !== currentTag.normalized_name) {
        const conflictingTag = await getTagByNormalizedName(normalizedName);

        if (conflictingTag !== undefined) {
          return {
            ok: false,
            error: "collision",
            conflictingTagId: conflictingTag.tag_id
          };
        }
      }

      const nextTag: TagRecord = {
        ...currentTag,
        normalized_name: normalizedName,
        display_name: displayName
      };

      await updateTag(nextTag);
      await archiveDb.post_tags.where("tag_id").equals(tagId).modify({
        normalized_name: normalizedName,
        display_name: displayName
      });

      return {
        ok: true,
        tag: nextTag
      };
    }
  );

  if (result.ok) {
    logger.info("tags.rename.completed", {
      context: {
        tagId,
        oldNormalizedName: previousNormalizedName,
        newNormalizedName: normalizedName
      }
    });
  }

  return result;
}

export async function mergeTags(
  sourceTagId: string,
  targetTagId: string,
  preserveFutureTagUses = true
): Promise<{
  mergedPostCount: number;
  removedDuplicateCount: number;
}> {
  if (sourceTagId === targetTagId) {
    throw new Error("Cannot merge the same tag.");
  }

  let mergedPostCount = 0;
  let removedDuplicateCount = 0;

  await archiveDb.transaction(
    "rw",
    archiveDb.tags,
    archiveDb.tag_redirects,
    archiveDb.post_tags,
    async () => {
      const [sourceTag, targetTag] = await Promise.all([
        getTagById(sourceTagId),
        getTagById(targetTagId)
      ]);

      if (sourceTag === undefined || targetTag === undefined) {
        throw new Error("Tag not found.");
      }

      const sourcePostTags = await listPostTagsByTagId(sourceTagId);
      const targetPostTags = await listPostTagsByTagId(targetTagId);
      const inheritedRedirects = await listTagRedirectsByTargetTagId(sourceTagId);
      const targetPostIds = new Set(targetPostTags.map((record) => record.x_post_id));

      for (const record of sourcePostTags) {
        if (targetPostIds.has(record.x_post_id)) {
          await deletePostTag(record.post_tag_id);
          removedDuplicateCount += 1;
          continue;
        }

        await archiveDb.post_tags.put({
          ...record,
          tag_id: targetTag.tag_id,
          normalized_name: targetTag.normalized_name,
          display_name: targetTag.display_name
        });
        targetPostIds.add(record.x_post_id);
        mergedPostCount += 1;
      }

      for (const redirect of inheritedRedirects) {
        await putTagRedirect({
          ...redirect,
          target_tag_id: targetTagId
        });
      }

      if (preserveFutureTagUses) {
        await upsertTagRedirect({
          source_normalized_name: sourceTag.normalized_name,
          source_display_name: sourceTag.display_name,
          target_tag_id: targetTagId
        });
      }

      await deleteTagsByIds([sourceTagId]);
    }
  );

  logger.info("tags.merge.completed", {
    context: {
      sourceTagId,
      targetTagId,
      preserveFutureTagUses,
      mergedPostCount,
      removedDuplicateCount
    }
  });

  return {
    mergedPostCount,
    removedDuplicateCount
  };
}

export async function bulkAssignTagPreview(
  filter: PostFilterInput,
  targetTagName: string
): Promise<{
  candidatePostIds: string[];
  targetTagId: string;
  targetNormalizedName: string;
  targetDisplayName: string;
  totalMatchCount: number;
  skipCount: number;
}> {
  const normalizedName = normalizeTagName(targetTagName);

  if (normalizedName === null) {
    throw new Error("Invalid tag name.");
  }

  const cleanedDisplayName = cleanupTagName(targetTagName);
  const pageInput: ListPostsPageInput = {
    offset: 0,
    limit: 1,
    sortField: "saved_at",
    sortDirection: "desc",
    randomSeed: null,
    tagFilter: filter.tagFilter,
    excludeTagFilter: filter.excludeTagFilter,
    authorFilter: filter.authorFilter,
    dateFilterTarget: filter.dateFilterTarget,
    dateFrom: filter.dateFrom,
    dateTo: filter.dateTo,
    keywordFilter: filter.keywordFilter
  };
  const matchingPostIds = await resolveFilteredPostIds(pageInput);
  const resolvedPostIds = matchingPostIds === null ? await listPostIds() : [...matchingPostIds];
  const totalMatchCount = resolvedPostIds.length;

  const tag =
    (await getTagByNormalizedName(normalizedName)) ?? {
      tag_id: crypto.randomUUID(),
      normalized_name: normalizedName,
      display_name: cleanedDisplayName,
      system_key: null,
      created_at: Date.now()
    };

  const alreadyTaggedIds = new Set(await listPostIdsByTagId(tag.tag_id));
  const candidatePostIds = resolvedPostIds.filter((postId) => !alreadyTaggedIds.has(postId));

  return {
    candidatePostIds,
    targetTagId: tag.tag_id,
    targetNormalizedName: tag.normalized_name,
    targetDisplayName: tag.display_name,
    totalMatchCount,
    skipCount: totalMatchCount - candidatePostIds.length
  };
}

export async function bulkAssignTagApplyBatch(
  postIds: string[],
  targetTagId: string,
  targetNormalizedName: string,
  targetDisplayName: string
): Promise<{
  tagged: number;
}> {
  if (postIds.length === 0) {
    return {
      tagged: 0
    };
  }

  const now = Date.now();
  const tagged = await archiveDb.transaction("rw", archiveDb.tags, archiveDb.post_tags, async () => {
    let targetTag = await getTagById(targetTagId);

    if (targetTag === undefined) {
      targetTag = await getTagByNormalizedName(targetNormalizedName);
    }

    if (targetTag === undefined) {
      targetTag = {
        tag_id: targetTagId,
        normalized_name: targetNormalizedName,
        display_name: targetDisplayName,
        system_key: null,
        created_at: now
      };
      await addTag(targetTag);
    }

    const records: PostTagRecord[] = postIds.map((postId) => ({
      post_tag_id: crypto.randomUUID(),
      x_post_id: postId,
      tag_id: targetTag.tag_id,
      normalized_name: targetTag.normalized_name,
      display_name: targetTag.display_name,
      system_key: targetTag.system_key,
      source: "manual",
      assigned_at: now
    }));

    return bulkAddPostTagRecords(records);
  });

  return {
    tagged
  };
}

export async function persistVideoThumbnailPreview(
  media: Pick<MediaRecord, "media_id" | "x_post_id">,
  thumbnailBlob: Blob
): Promise<string> {
  const previewPath = buildVideoPreviewOpfsPath(media.x_post_id, media.media_id);

  await writeBlobToOpfs(previewPath, thumbnailBlob);
  await updateMediaPreview(media.media_id, {
    preview_image_opfs_path: previewPath
  });

  logger.debug("media.preview.persisted", {
    context: {
      xPostId: media.x_post_id,
      mediaId: media.media_id
    }
  });

  return previewPath;
}

export async function deleteArchivePost(xPostId: string): Promise<boolean> {
  const existing = await getPost(xPostId);

  if (existing === undefined) {
    return false;
  }

  const media = await listMediaByPostId(xPostId);

  for (const item of media) {
    try {
      await deleteBlobFromOpfs(item.opfs_path);
    } catch (error) {
      logger.warn("media.delete.opfs_failed", {
        message: "Failed to delete OPFS media file.",
        context: {
          mediaId: item.media_id,
          xPostId,
          error
        }
      });
    }

    if (typeof item.preview_image_opfs_path === "string") {
      try {
        await deleteBlobFromOpfs(item.preview_image_opfs_path);
      } catch (error) {
        logger.warn("media.preview.delete.opfs_failed", {
          message: "Failed to delete OPFS preview media file.",
          context: {
            mediaId: item.media_id,
            xPostId,
            error
          }
        });
      }
    }
  }

  await archiveDb.transaction(
    "rw",
    archiveDb.posts,
    archiveDb.media,
    archiveDb.tags,
    archiveDb.post_tags,
    async () => {
      const postTags = await listPostTagsByPostId(xPostId);
      const orphanedTagIds = [...new Set(postTags.map((item) => item.tag_id))];

      await deletePostTagsByPostId(xPostId);
      await deleteMediaRecordsByPostId(xPostId);
      await deletePostRecord(xPostId);
      await deleteOrphanedTags(orphanedTagIds);
    }
  );

  logger.info("post.delete.persisted", {
    context: {
      xPostId
    }
  });

  return true;
}

async function persistMedia(record: MediaRecord, traceId?: string): Promise<void> {
  if (activeMediaPersistenceIds.has(record.media_id)) {
    return;
  }

  activeMediaPersistenceIds.add(record.media_id);

  try {
    logger.info("media.persist.started", {
      context: {
        mediaId: record.media_id,
        xPostId: record.x_post_id,
        mediaType: record.media_type,
        traceId: traceId ?? null
      }
    });

    const response = await fetch(record.source_url, {
      credentials: "omit"
    });

    if (!response.ok) {
      throw new Error(`Media fetch failed with status ${response.status}.`);
    }

    const blob = await response.blob();
    const mimeType = blob.type || response.headers.get("content-type");

    if (!isAllowedMediaMimeType(record.media_type, mimeType)) {
      throw new Error(
        `Media fetch returned an unsupported content type (${mimeType ?? "unknown"}) for ${record.media_type}.`
      );
    }

    const writeResult = await writeBlobToOpfs(record.opfs_path, blob);
    await updateMediaAfterWrite(record.media_id, {
      mime_type: mimeType === null || mimeType.trim() === "" ? null : mimeType,
      byte_size: blob.size,
      checksum: writeResult.checksum,
      storage_status: "ready",
      last_error: null
    });

    logger.info("media.persist.succeeded", {
      context: {
        mediaId: record.media_id,
        xPostId: record.x_post_id,
        mediaType: record.media_type,
        byteSize: blob.size,
        traceId: traceId ?? null
      }
    });
  } catch (error) {
    const quotaExceeded = isQuotaExceededError(error);
    const lastError =
      error instanceof Error
        ? `${quotaExceeded ? "OPFS quota exceeded: " : ""}${error.message}`
        : quotaExceeded
          ? "OPFS quota exceeded."
          : "Media persistence failed.";

    await updateMediaAfterWrite(record.media_id, {
      mime_type: null,
      byte_size: null,
      checksum: null,
      storage_status: "failed",
      last_error: lastError
    });

    logger[quotaExceeded ? "warn" : "error"]("media.persist.failed", {
      message: quotaExceeded ? "Media persistence failed because OPFS quota was exceeded." : "Media persistence failed.",
      context: {
        mediaId: record.media_id,
        xPostId: record.x_post_id,
        mediaType: record.media_type,
        quotaExceeded,
        error,
        traceId: traceId ?? null
      }
    });
  } finally {
    activeMediaPersistenceIds.delete(record.media_id);
  }
}

function enqueueMediaPersistence(media: MediaRecord[], traceId?: string): void {
  if (media.length === 0) {
    return;
  }

  logger.debug("media.persist.enqueued", {
    context: {
      count: media.length,
      traceId: traceId ?? null
    }
  });

  void Promise.allSettled(media.map((record) => persistMedia(record, traceId))).then((results) => {
    for (const [index, result] of results.entries()) {
      if (result.status === "fulfilled") {
        continue;
      }

      logger.error("media.persist.queue_failed", {
        message: "Queued media persistence failed unexpectedly.",
        context: {
          mediaId: media[index]?.media_id,
          xPostId: media[index]?.x_post_id,
          reason: result.reason,
          traceId: traceId ?? null
        }
      });
    }
  });
}

async function enqueueThreadExpandIfCandidate(
  input: SavePostInput,
  options: {
    enabled: boolean;
    normalizedInReplyToPostId: string | null;
    normalizedThreadRootId: string | null;
    traceId: string | undefined;
  }
): Promise<void> {
  if (!options.enabled || options.normalizedInReplyToPostId === null) {
    return;
  }

  const threadRootIdEstimate = options.normalizedThreadRootId ?? options.normalizedInReplyToPostId;

  try {
    const record = await enqueueThreadExpand({
      candidate_post_id: input.x_post_id,
      thread_root_id: threadRootIdEstimate
    });

    logger.info("thread_expand.enqueue.completed", {
      context: {
        candidatePostId: input.x_post_id,
        threadRootId: threadRootIdEstimate,
        queueId: record.id ?? null,
        status: record.status,
        traceId: options.traceId ?? null
      }
    });
  } catch (error) {
    logger.warn("thread_expand.enqueue.failed", {
      message: "Failed to enqueue thread expansion.",
      context: {
        candidatePostId: input.x_post_id,
        threadRootId: threadRootIdEstimate,
        error,
        traceId: options.traceId ?? null
      }
    });
  }
}

async function waitForInactiveMediaPersistence(media: MediaRecord[]): Promise<void> {
  const mediaIds = new Set(media.map((record) => record.media_id));
  const startedAt = Date.now();

  while ([...mediaIds].some((mediaId) => activeMediaPersistenceIds.has(mediaId))) {
    if (Date.now() - startedAt >= MEDIA_PERSISTENCE_IDLE_MAX_WAIT_MS) {
      throw new Error("Timed out waiting for in-flight media persistence before refetch.");
    }

    await new Promise((resolve) => setTimeout(resolve, MEDIA_PERSISTENCE_IDLE_WAIT_MS));
  }
}

export async function resumePendingMediaPersistence(): Promise<void> {
  if (pendingResumePromise !== null) {
    return pendingResumePromise;
  }

  pendingResumePromise = (async () => {
    const pendingMedia = await listMediaByStorageStatus("pending", PENDING_MEDIA_RESUME_BATCH_SIZE);

    if (pendingMedia.length === 0) {
      logger.debug("media.resume.noop");
      return;
    }

    logger.info("media.resume.started", {
      context: {
        count: pendingMedia.length
      }
    });

    enqueueMediaPersistence(pendingMedia);
  })().finally(() => {
    pendingResumePromise = null;
  });

  return pendingResumePromise;
}

async function hydrateArchivePosts(posts: PostRecord[]): Promise<ArchivePostRecord[]> {
  const basePosts = await hydrateArchivePostsBase(posts);
  const quotedPostIds = [...new Set(basePosts.flatMap((post) =>
    typeof post.quoted_post_id === "string" && post.quoted_post_id.trim() !== ""
      ? [post.quoted_post_id]
      : []
  ))];

  if (quotedPostIds.length === 0) {
    return basePosts;
  }

  const quotedPosts = await getPostsByIds(quotedPostIds);

  if (quotedPosts.length === 0) {
    return basePosts;
  }

  const hydratedQuotedPosts = await hydrateArchivePostsBase(quotedPosts);
  const quotedPostMap = new Map(
    hydratedQuotedPosts.map((post) => [post.x_post_id, post] as const)
  );

  return basePosts.map((post) => {
    const quotedPost =
      typeof post.quoted_post_id === "string"
        ? quotedPostMap.get(post.quoted_post_id)
        : undefined;

    return quotedPost === undefined
      ? post
      : {
          ...post,
          quoted_post: quotedPost
        };
  });
}

async function hydrateArchivePostsBase(posts: PostRecord[]): Promise<ArchivePostRecord[]> {
  const postIds = posts.map((post) => post.x_post_id);
  const media = await listMediaByPostIds(postIds);
  const postTags = await listPostTagsByPostIds(postIds);
  const threadCounts = await resolveThreadPostCounts(posts);
  const mediaMap = new Map<string, MediaRecord[]>();
  const tagMap = new Map<string, ArchiveTagRecord[]>();

  for (const item of media) {
    const normalizedItem = normalizeMediaRecord(item);
    const current = mediaMap.get(normalizedItem.x_post_id);

    if (current === undefined) {
      mediaMap.set(normalizedItem.x_post_id, [normalizedItem]);
      continue;
    }

    current.push(normalizedItem);
  }

  for (const item of postTags) {
    const normalizedItem = normalizeArchiveTag(item);
    const current = tagMap.get(normalizedItem.x_post_id);

    if (current === undefined) {
      tagMap.set(normalizedItem.x_post_id, [normalizedItem.tag]);
      continue;
    }

    current.push(normalizedItem.tag);
  }

  return posts.map((post) => {
    const threadPostCount = threadCounts.get(post.x_post_id);

    return {
      ...post,
      media: mediaMap.get(post.x_post_id) ?? [],
      tags: sortArchiveTags(tagMap.get(post.x_post_id) ?? []),
      ...(threadPostCount === undefined ? {} : { thread_post_count: threadPostCount })
    };
  });
}

async function resolveThreadPostCounts(posts: PostRecord[]): Promise<Map<string, number>> {
  const rootIds = posts.flatMap((post) => {
    const threadRootId = normalizeOptionalPostId(post.thread_root_id);
    return threadRootId === post.x_post_id ? [post.x_post_id] : [];
  });
  const uniqueRootIds = [...new Set(rootIds)];

  if (uniqueRootIds.length === 0) {
    return new Map();
  }

  return countThreadPostsByRoots(uniqueRootIds);
}

function buildThreadedPostTree(
  rootId: string,
  posts: ArchivePostRecord[]
): ThreadedPostRecord | null {
  const nodes = new Map<string, ThreadedPostRecord>(
    posts.map((post) => [
      post.x_post_id,
      {
        ...post,
        children: []
      }
    ])
  );
  const root = nodes.get(rootId) ?? nodes.get(posts[0]?.x_post_id ?? "");

  if (root === undefined) {
    return null;
  }

  for (const post of posts) {
    const node = nodes.get(post.x_post_id);

    if (node === undefined || node.x_post_id === root.x_post_id) {
      continue;
    }

    const parentId = normalizeOptionalPostId(post.in_reply_to_post_id);
    const parent = parentId === null ? undefined : nodes.get(parentId);

    if (parent !== undefined) {
      parent.children.push(node);
    }
  }

  sortThreadedPostChildren(root, new Set<string>());
  return root;
}

function sortThreadedPostChildren(post: ThreadedPostRecord, seen: Set<string>): void {
  if (seen.has(post.x_post_id)) {
    return;
  }

  seen.add(post.x_post_id);
  post.children.sort(compareThreadedPosts);

  for (const child of post.children) {
    sortThreadedPostChildren(child, seen);
  }
}

function compareThreadedPosts(left: ThreadedPostRecord, right: ThreadedPostRecord): number {
  if (left.posted_at !== right.posted_at) {
    return left.posted_at - right.posted_at;
  }

  return left.x_post_id.localeCompare(right.x_post_id);
}

async function listFilteredPostsPage(
  input: ListPostsPageInput,
  matchingPostIds: Set<string>,
  offset: number,
  limit: number,
  startCursor: PostPageCursor | null
): Promise<{ posts: PostRecord[]; nextCursor: PostPageCursor | null }> {
  if (input.sortField === "random") {
    throw new Error("listFilteredPostsPage cannot be used with random sort.");
  }

  const sortField = input.sortField;
  const results: PostRecord[] = [];
  const scanChunkSize = Math.max(limit * 3, 100);
  // When startCursor is provided we resume from where the client left off, so offset is irrelevant.
  // When it's null we still need the legacy offset path (e.g. filter changes that reset the cursor
  // but keep a non-zero scroll position).
  const offsetToSkip = startCursor === null ? offset : 0;
  let skippedMatches = 0;
  let cursor: PostPageCursor | null = startCursor;

  while (results.length < limit) {
    const chunk = await listPostsSliceBySort(
      sortField,
      input.sortDirection,
      cursor,
      scanChunkSize
    );

    if (chunk.length === 0) {
      break;
    }

    cursor = buildPostPageCursor(chunk[chunk.length - 1], sortField, input.sortDirection);

    for (const post of chunk) {
      if (!matchingPostIds.has(post.x_post_id)) {
        continue;
      }

      if (skippedMatches < offsetToSkip) {
        skippedMatches += 1;
        continue;
      }

      results.push(post);

      if (results.length >= limit) {
        break;
      }
    }
  }

  // results.length < limit means the underlying scan exhausted the dataset, so there is no
  // next page. Returning null avoids the ambiguity of a non-null cursor that would lead the
  // client into an empty follow-up query.
  const nextCursor =
    results.length < limit
      ? null
      : buildPostPageCursor(results[results.length - 1], sortField, input.sortDirection);

  return { posts: results, nextCursor };
}

export async function refetchArchivePost(
  xPostId: string,
  input: SavePostInput,
  options: {
    traceId?: string;
  } = {}
): Promise<PostRecord> {
  validateSavePostInput(input);

  if (xPostId !== input.x_post_id) {
    throw new Error("Refetch target does not match extracted post.");
  }

  const existingPost = await getPost(xPostId);

  if (existingPost === undefined) {
    throw new Error("Post not found.");
  }

  const existingMedia = await listMediaByPostId(xPostId);
  const preparedMediaUpdate = prepareRefetchedMediaUpdate(xPostId, input, existingMedia);
  await waitForInactiveMediaPersistence(preparedMediaUpdate.removedRecords);
  const normalizedQuotedPostId =
    normalizeOptionalPostId(input.quoted_post_id) ?? existingPost.quoted_post_id ?? null;
  const normalizedInReplyToPostId =
    normalizeOptionalPostId(input.in_reply_to_post_id) ?? existingPost.in_reply_to_post_id ?? null;
  const normalizedThreadRootId =
    normalizeOptionalPostId(input.thread_root_id) ?? existingPost.thread_root_id ?? null;
  const removedMediaPaths = preparedMediaUpdate.removedRecords.flatMap((record) =>
    [record.opfs_path, record.preview_image_opfs_path].filter(
      (path): path is string => typeof path === "string" && path.trim() !== ""
    )
  );

  const updatedPost: PostRecord = {
    ...existingPost,
    display_name: input.display_name.trim(),
    x_username: input.x_username.trim(),
    post_text: input.post_text.trim(),
    post_url: input.post_url.trim(),
    posted_at: input.posted_at,
    reply_count: input.reply_count,
    repost_count: input.repost_count,
    like_count: input.like_count,
    in_reply_to_post_id: normalizedInReplyToPostId,
    thread_root_id: normalizedThreadRootId,
    quoted_post_id: normalizedQuotedPostId
  };

  await archiveDb.transaction("rw", archiveDb.posts, archiveDb.media, async () => {
    await updatePostFields(xPostId, {
      display_name: updatedPost.display_name,
      x_username: updatedPost.x_username,
      post_text: updatedPost.post_text,
      post_url: updatedPost.post_url,
      posted_at: updatedPost.posted_at,
      reply_count: updatedPost.reply_count,
      repost_count: updatedPost.repost_count,
      like_count: updatedPost.like_count,
      in_reply_to_post_id: normalizedInReplyToPostId,
      thread_root_id: normalizedThreadRootId,
      quoted_post_id: normalizedQuotedPostId
    });

    if (preparedMediaUpdate.removedRecords.length > 0) {
      for (const record of preparedMediaUpdate.removedRecords) {
        await archiveDb.media.delete(record.media_id);
      }
    }

    for (const record of preparedMediaUpdate.reusedRecords) {
      await archiveDb.media.put(record);
    }

    if (preparedMediaUpdate.newRecords.length > 0) {
      await addMediaRecords(preparedMediaUpdate.newRecords);
    }
  });

  for (const opfsPath of removedMediaPaths) {
    try {
      await deleteBlobFromOpfs(opfsPath);
    } catch {
      // Best-effort cleanup only; stale files should not block refetch completion.
    }
  }

  if (preparedMediaUpdate.persistRecords.length > 0) {
    enqueueMediaPersistence(preparedMediaUpdate.persistRecords, options.traceId);
  }

  logger.info("post.refetch.persisted", {
    context: {
      xPostId,
      removedMediaCount: preparedMediaUpdate.removedRecords.length,
      reusedMediaCount: preparedMediaUpdate.reusedRecords.length,
      newMediaCount: preparedMediaUpdate.newRecords.length,
      persistMediaCount: preparedMediaUpdate.persistRecords.length,
      traceId: options.traceId ?? null
    }
  });

  return updatedPost;
}

async function listRandomPostsPage(
  matchingPostIds: Set<string>,
  offset: number,
  limit: number,
  randomSeed: number
): Promise<PostRecord[]> {
  const orderedIds = [...matchingPostIds];

  if (orderedIds.length === 0) {
    return [];
  }

  const quotedPostIds = await getQuotedPostIdSet();
  const candidateIds = orderedIds.filter((postId) => !quotedPostIds.has(postId));

  if (candidateIds.length === 0) {
    return [];
  }

  return getPostsByIds(selectSeededRandomIds(candidateIds, offset, limit, randomSeed));
}

async function resolveViewerListPostIds(matchingPostIds: Set<string> | null): Promise<Set<string>> {
  const rootOrSinglePostIds = new Set(await listRootOrSinglePostIds());

  if (matchingPostIds === null) {
    return rootOrSinglePostIds;
  }

  const matchingPosts = await getPostsByIds([...matchingPostIds]);
  const result = new Set<string>();

  for (const post of matchingPosts) {
    const threadRootId = normalizeOptionalPostId(post.thread_root_id);
    const viewerPostId = threadRootId ?? post.x_post_id;

    if (rootOrSinglePostIds.has(viewerPostId)) {
      result.add(viewerPostId);
    }
  }

  return result;
}

async function getQuotedPostIdSet(): Promise<Set<string>> {
  const quotingPosts = await archiveDb.posts.where("quoted_post_id").above("").toArray();

  return new Set(
    quotingPosts.flatMap((post) =>
      typeof post.quoted_post_id === "string" && post.quoted_post_id.trim() !== ""
        ? [post.quoted_post_id]
        : []
    )
  );
}

async function resolveFilteredPostIds(input: ListPostsPageInput): Promise<Set<string> | null> {
  const tagFilterPostIds =
    input.tagFilter === null ? null : new Set(await listPostIdsByNormalizedName(input.tagFilter));
  const excludeTagPostIds =
    input.excludeTagFilter == null
      ? null
      : new Set(await listPostIdsByNormalizedName(input.excludeTagFilter));
  const authorFilter = normalizeAuthorFilter(input.authorFilter);
  const keywordFilter = normalizeKeywordFilter(input.keywordFilter);
  const dateFilterTarget = normalizeDateFilterTarget(input.dateFilterTarget);
  const dateFrom = normalizeDateFilterTimestamp(input.dateFrom);
  const dateTo = normalizeDateFilterTimestamp(input.dateTo);
  const dateFilterPostIds =
    dateFilterTarget === null || (dateFrom === null && dateTo === null)
      ? null
      : new Set(await listPostIdsByDateFilter(dateFilterTarget, dateFrom, dateTo));
  const keywordFilterPostIds =
    keywordFilter === null ? null : new Set(await listPostIdsByKeyword(keywordFilter));

  if (
    tagFilterPostIds === null &&
    excludeTagPostIds === null &&
    authorFilter === null &&
    dateFilterPostIds === null &&
    keywordFilterPostIds === null
  ) {
    return null;
  }

  const authorFilterPostIds =
    authorFilter === null ? null : new Set(await listPostIdsByAuthorFilter(authorFilter));
  const filterSets = [
    tagFilterPostIds,
    authorFilterPostIds,
    dateFilterPostIds,
    keywordFilterPostIds
  ].filter((value): value is Set<string> => value !== null);

  const result =
    filterSets.length === 0 ? new Set(await listPostIds()) : new Set<string>(filterSets[0]);

  if (filterSets.length > 0) {
    for (const postId of result) {
      for (let index = 1; index < filterSets.length; index += 1) {
        const currentSet = filterSets[index];

        if (currentSet !== undefined && !currentSet.has(postId)) {
          result.delete(postId);
          break;
        }
      }
    }
  }

  if (excludeTagPostIds !== null) {
    for (const postId of excludeTagPostIds) {
      result.delete(postId);
    }
  }

  return result;
}

function normalizePageOffset(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function normalizePageLimit(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 50;
  }

  return Math.min(Math.floor(value), 250);
}

function normalizeRandomSeed(value: number | null | undefined): number {
  if (!Number.isFinite(value)) {
    return 1;
  }

  const normalized = Math.floor(Math.abs(value ?? 1)) >>> 0;
  return normalized === 0 ? 1 : normalized;
}

function selectSeededRandomIds(
  ids: string[],
  offset: number,
  limit: number,
  randomSeed: number
): string[] {
  const selectionEnd = Math.min(ids.length, offset + limit);

  if (offset >= selectionEnd) {
    return [];
  }

  const random = createSeededRandom(randomSeed);

  for (let index = 0; index < selectionEnd; index += 1) {
    const swapIndex = index + Math.floor(random() * (ids.length - index));
    const current = ids[index];
    const target = ids[swapIndex];

    if (current === undefined || target === undefined) {
      continue;
    }

    ids[index] = target;
    ids[swapIndex] = current;
  }

  return ids.slice(offset, selectionEnd);
}

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let next = Math.imul(state ^ (state >>> 15), state | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

async function listPostIdsByAuthorFilter(authorFilter: string): Promise<string[]> {
  const usernames = await listPostUsernames();
  const matchingUsernames = usernames.filter(
    (username) => normalizeAuthorFilter(username) === authorFilter
  );

  if (matchingUsernames.length === 0) {
    return [];
  }

  const idsByUsername = await Promise.all(matchingUsernames.map(listPostIdsByUsername));
  return idsByUsername.flat();
}

async function listPostIdsByDateFilter(
  target: DateFilterTarget,
  dateFrom: number | null,
  dateTo: number | null
): Promise<string[]> {
  const index = archiveDb.posts.where(target);

  if (dateFrom !== null && dateTo !== null) {
    return (await index.between(dateFrom, dateTo, true, true).primaryKeys()).map(String);
  }

  if (dateFrom !== null) {
    return (await index.aboveOrEqual(dateFrom).primaryKeys()).map(String);
  }

  if (dateTo !== null) {
    return (await index.belowOrEqual(dateTo).primaryKeys()).map(String);
  }

  return listPostIds();
}

async function assignAutoTags(xPostId: string, inputs: PostTagInput[]): Promise<void> {
  for (const item of inputs) {
    const tag = await ensureTagRecord(
      item.normalized_name,
      item.display_name,
      item.system_key,
      item.assigned_at
    );
    const existingPostTag = await getPostTagByNormalizedName(xPostId, item.normalized_name);

    if (existingPostTag !== undefined) {
      continue;
    }

    await addPostTag({
      post_tag_id: crypto.randomUUID(),
      x_post_id: xPostId,
      tag_id: tag.tag_id,
      normalized_name: tag.normalized_name,
      display_name: tag.display_name,
      system_key: tag.system_key,
      source: item.source,
      assigned_at: item.assigned_at
    });
  }
}

async function ensureTagRecord(
  normalizedName: string,
  displayName: string,
  systemKey: BuiltInTagKey | null,
  createdAt: number
): Promise<TagRecord> {
  const existing = await getTagByNormalizedName(normalizedName);

  if (existing !== undefined) {
    return existing;
  }

  const record: TagRecord = {
    tag_id: crypto.randomUUID(),
    normalized_name: normalizedName,
    display_name: displayName,
    system_key: systemKey,
    created_at: createdAt
  };

  await addTag(record);
  return record;
}

async function upsertTagRedirect(
  input: Pick<TagRedirectRecord, "source_normalized_name" | "source_display_name" | "target_tag_id">
): Promise<void> {
  const existing = await getTagRedirectBySourceNormalizedName(input.source_normalized_name);

  await putTagRedirect({
    tag_redirect_id: existing?.tag_redirect_id ?? crypto.randomUUID(),
    source_normalized_name: input.source_normalized_name,
    source_display_name: input.source_display_name,
    target_tag_id: input.target_tag_id,
    created_at: existing?.created_at ?? Date.now()
  });
}

async function deleteOrphanedTag(tagId: string): Promise<void> {
  const count = await countPostTagLinksByTagId(tagId);

  if (count === 0) {
    await deleteTagsByIds([tagId]);
  }
}

async function deleteOrphanedTags(tagIds: string[]): Promise<void> {
  const orphanedIds: string[] = [];

  for (const tagId of tagIds) {
    const count = await countPostTagLinksByTagId(tagId);

    if (count === 0) {
      orphanedIds.push(tagId);
    }
  }

  await deleteTagsByIds(orphanedIds);
}

function buildAutoTagRecords(
  xPostId: string,
  postText: string,
  explicitAutoTags: string[],
  assignedAt: number
): PostTagInput[] {
  const uniqueTags = new Map<string, string>();
  const candidates = [...extractHashtags(postText), ...explicitAutoTags];

  for (const tagName of candidates) {
    const normalizedName = normalizeTagName(tagName);

    if (normalizedName === null || uniqueTags.has(normalizedName)) {
      continue;
    }

    uniqueTags.set(normalizedName, cleanupTagName(tagName));
  }

  return [...uniqueTags.values()].map((tagName) =>
    createPostTagInput(xPostId, tagName, "auto", assignedAt)
  );
}

function extractHashtags(postText: string): string[] {
  const matches = postText.matchAll(/(^|\s)#([\p{L}\p{N}_]+)/gu);
  const uniqueTags = new Map<string, string>();

  for (const match of matches) {
    const candidate = match[2];
    const normalizedName = candidate === undefined ? null : normalizeTagName(candidate);

    if (candidate === undefined || normalizedName === null || uniqueTags.has(normalizedName)) {
      continue;
    }

    uniqueTags.set(normalizedName, candidate.trim());
  }

  return [...uniqueTags.values()];
}

function createPendingImageRecord(
  xPostId: string,
  image: SaveImageInput,
  savedAt: number
): MediaRecord {
  validateSaveImageInput(image);

  const mediaId = crypto.randomUUID();
  const canonicalSourceUrl = canonicalizeTwitterImageUrl(image.source_url) ?? image.source_url;

  return {
    media_id: mediaId,
    x_post_id: xPostId,
    media_type: "image",
    source_url: canonicalSourceUrl,
    preview_image_url: null,
    preview_image_opfs_path: null,
    opfs_path: buildMediaOpfsPath(xPostId, mediaId, "image"),
    position: image.position,
    alt_text: image.alt_text,
    width: image.width,
    height: image.height,
    mime_type: null,
    byte_size: null,
    checksum: null,
    storage_status: "pending",
    saved_at: savedAt,
    last_error: null
  };
}

function createPendingVideoRecord(
  xPostId: string,
  video: SaveVideoCandidateInput,
  savedAt: number,
  position: number
): MediaRecord {
  validateSaveVideoCandidateInput(video);

  const mediaId = crypto.randomUUID();

  return {
    media_id: mediaId,
    x_post_id: xPostId,
    media_type: "video",
    source_url: video.source_url,
    preview_image_url: video.thumbnail_url ?? video.poster_url,
    preview_image_opfs_path: null,
    opfs_path: buildMediaOpfsPath(xPostId, mediaId, "video"),
    position,
    alt_text: null,
    width: video.width,
    height: video.height,
    mime_type: video.mime_type,
    byte_size: null,
    checksum: null,
    storage_status: "pending",
    saved_at: savedAt,
    last_error: null
  };
}

async function prepareDuplicateMediaWork(input: SavePostInput): Promise<{
  newRecords: MediaRecord[];
  retryRecords: MediaRecord[];
  persistRecords: MediaRecord[];
}> {
  const existingMedia = await listMediaByPostId(input.x_post_id);
  const existingBySourceKey = new Map<string, MediaRecord>();

  for (const media of existingMedia) {
    existingBySourceKey.set(getMediaSourceKey(media.media_type, media.source_url), media);
  }

  const savedAt = Date.now();
  const newRecords: MediaRecord[] = [];
  const retryRecords: MediaRecord[] = [];

  for (const image of input.media) {
    const sourceKey = getMediaSourceKey("image", image.source_url);
    const existing = existingBySourceKey.get(sourceKey);

    if (existing === undefined) {
      newRecords.push(createPendingImageRecord(input.x_post_id, image, savedAt));
      continue;
    }

    if (existing.storage_status !== "ready") {
      retryRecords.push(existing);
    }
  }

  for (const [index, candidate] of (input.video_candidates ?? [])
    .filter((video) => video.download_mode === "direct_mp4")
    .entries()) {
    const sourceKey = getMediaSourceKey("video", candidate.source_url);
    const existing = existingBySourceKey.get(sourceKey);

    if (existing === undefined) {
      newRecords.push(
        createPendingVideoRecord(input.x_post_id, candidate, savedAt, input.media.length + index)
      );
      continue;
    }

    if (existing.storage_status !== "ready") {
      retryRecords.push(existing);
    }
  }

  const persistRecords = [...retryRecords, ...newRecords];

  return {
    newRecords,
    retryRecords: dedupeMediaRecordsById(retryRecords),
    persistRecords: dedupeMediaRecordsById(persistRecords)
  };
}

function createPostTagInput(
  xPostId: string,
  tagName: string,
  source: TagSource,
  assignedAt = Date.now()
): PostTagInput {
  const normalizedName = normalizeTagName(tagName);

  if (normalizedName === null) {
    throw new Error("Invalid tag name.");
  }

  const cleanedTagName = cleanupTagName(tagName);

  return {
    x_post_id: xPostId,
    normalized_name: normalizedName,
    display_name: cleanedTagName,
    system_key: source === "auto" ? resolveKnownBuiltInTagKey(normalizedName, cleanedTagName) : null,
    source,
    assigned_at: assignedAt
  };
}

function validateSavePostInput(input: SavePostInput): void {
  requireNonEmptyString(input.x_post_id, "x_post_id");
  requireNonEmptyString(input.display_name, "display_name");
  requireNonEmptyString(input.x_username, "x_username");
  requireNonEmptyString(input.post_url, "post_url");
  requireFiniteTimestamp(input.posted_at, "posted_at");
  requireFiniteCount(input.reply_count, "reply_count");
  requireFiniteCount(input.repost_count, "repost_count");
  requireFiniteCount(input.like_count, "like_count");

  if (
    input.quoted_post_id !== undefined &&
    input.quoted_post_id !== null &&
    (typeof input.quoted_post_id !== "string" || input.quoted_post_id.trim() === "")
  ) {
    throw new Error("Invalid quoted_post_id.");
  }

  if (
    input.in_reply_to_post_id !== undefined &&
    input.in_reply_to_post_id !== null &&
    (typeof input.in_reply_to_post_id !== "string" || input.in_reply_to_post_id.trim() === "")
  ) {
    throw new Error("Invalid in_reply_to_post_id.");
  }

  if (
    input.thread_root_id !== undefined &&
    input.thread_root_id !== null &&
    (typeof input.thread_root_id !== "string" || input.thread_root_id.trim() === "")
  ) {
    throw new Error("Invalid thread_root_id.");
  }

  if (typeof input.post_text !== "string") {
    throw new Error("Invalid post_text.");
  }

  if (!Array.isArray(input.media)) {
    throw new Error("Invalid media list.");
  }

  if (input.video_candidates !== undefined && !Array.isArray(input.video_candidates)) {
    throw new Error("Invalid video candidate list.");
  }

  if (input.auto_tags !== undefined) {
    if (!Array.isArray(input.auto_tags)) {
      throw new Error("Invalid auto_tags.");
    }

    for (const tagName of input.auto_tags) {
      if (normalizeTagName(tagName) === null) {
        throw new Error("Invalid auto tag.");
      }
    }
  }

  const directMp4Candidates = (input.video_candidates ?? []).filter(
    (candidate) => candidate.download_mode === "direct_mp4"
  );

  if (
    input.post_text.trim() === "" &&
    input.media.length === 0 &&
    directMp4Candidates.length === 0
  ) {
    throw new Error("A post without text must include at least one savable media item.");
  }
}

function validateSaveImageInput(image: SaveImageInput): void {
  requireNonEmptyString(image.source_url, "source_url");

  if (!Number.isInteger(image.position) || image.position < 0) {
    throw new Error("Invalid media position.");
  }

  requireNullableFiniteNumber(image.width, "width");
  requireNullableFiniteNumber(image.height, "height");

  if (image.alt_text !== null && typeof image.alt_text !== "string") {
    throw new Error("Invalid alt_text.");
  }
}

function validateSaveVideoCandidateInput(video: SaveVideoCandidateInput): void {
  requireNonEmptyString(video.source_url, "video.source_url");
  requireNullableFiniteNumber(video.width, "video.width");
  requireNullableFiniteNumber(video.height, "video.height");
  requireNullableFiniteNumber(video.duration_sec, "video.duration_sec");

  if (video.poster_url !== null && typeof video.poster_url !== "string") {
    throw new Error("Invalid video.poster_url.");
  }

  if (video.thumbnail_url !== null && typeof video.thumbnail_url !== "string") {
    throw new Error("Invalid video.thumbnail_url.");
  }

  if (video.mime_type !== null && typeof video.mime_type !== "string") {
    throw new Error("Invalid video.mime_type.");
  }

  if (video.variant_key !== null && typeof video.variant_key !== "string") {
    throw new Error("Invalid video.variant_key.");
  }

  if (video.download_mode !== "direct_mp4" && video.download_mode !== "hls") {
    throw new Error("Invalid video.download_mode.");
  }
}

function requireNonEmptyString(value: string, field: string): void {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Invalid ${field}.`);
  }
}

function requireNullableFiniteNumber(value: number | null, field: string): void {
  if (value !== null && (!Number.isFinite(value) || value < 0)) {
    throw new Error(`Invalid ${field}.`);
  }
}

function requireFiniteTimestamp(value: number, field: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Invalid ${field}.`);
  }
}

function requireFiniteCount(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Invalid ${field}.`);
  }
}

function cleanupTagName(tagName: string): string {
  return tagName.trim().replace(/^#+/, "");
}

function normalizeTagName(tagName: string): string | null {
  if (typeof tagName !== "string") {
    return null;
  }

  const cleaned = cleanupTagName(tagName).replace(/\s+/g, " ").trim().toLocaleLowerCase("en-US");
  return cleaned === "" ? null : cleaned;
}

function normalizeMediaRecord(media: MediaRecord): MediaRecord {
  return {
    ...media,
    preview_image_url: media.preview_image_url ?? null,
    preview_image_opfs_path: media.preview_image_opfs_path ?? null,
    checksum: media.checksum ?? null
  };
}

function normalizeAuthorFilter(value: string | null): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value.trim().replace(/^@+/, "").toLocaleLowerCase("en-US");
  return cleaned === "" ? null : cleaned;
}

function normalizeKeywordFilter(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue === "" ? null : trimmedValue;
}

function normalizeOptionalPostId(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized === "" ? null : normalized;
}

function buildDuplicatePostFieldUpdate(
  existing: PostRecord,
  fields: {
    quoted_post_id: string | null;
    in_reply_to_post_id: string | null;
    thread_root_id: string | null;
  }
): Partial<PostRecord> {
  const update: Partial<PostRecord> = {};

  if (fields.quoted_post_id !== null && existing.quoted_post_id !== fields.quoted_post_id) {
    update.quoted_post_id = fields.quoted_post_id;
  }

  if (
    fields.in_reply_to_post_id !== null &&
    existing.in_reply_to_post_id !== fields.in_reply_to_post_id
  ) {
    update.in_reply_to_post_id = fields.in_reply_to_post_id;
  }

  if (fields.thread_root_id !== null && existing.thread_root_id !== fields.thread_root_id) {
    update.thread_root_id = fields.thread_root_id;
  }

  return update;
}

function prepareRefetchedMediaUpdate(
  xPostId: string,
  input: SavePostInput,
  existingMedia: MediaRecord[]
): {
  reusedRecords: MediaRecord[];
  newRecords: MediaRecord[];
  removedRecords: MediaRecord[];
  persistRecords: MediaRecord[];
} {
  const savedAt = Date.now();
  const existingBySourceKey = new Map<string, MediaRecord>();

  for (const media of existingMedia) {
    existingBySourceKey.set(getMediaSourceKey(media.media_type, media.source_url), media);
  }

  const nextRecords: MediaRecord[] = [];
  const persistRecords: MediaRecord[] = [];
  const seenSourceKeys = new Set<string>();

  for (const image of input.media) {
    const sourceKey = getMediaSourceKey("image", image.source_url);
    const existing = existingBySourceKey.get(sourceKey);

    seenSourceKeys.add(sourceKey);

    if (existing === undefined) {
      const nextRecord = createPendingImageRecord(xPostId, image, savedAt);
      nextRecords.push(nextRecord);
      persistRecords.push(nextRecord);
      continue;
    }

    const reusedRecord: MediaRecord = {
      ...existing,
      source_url: canonicalizeTwitterImageUrl(image.source_url) ?? image.source_url,
      position: image.position,
      alt_text: image.alt_text,
      width: image.width,
      height: image.height
    };

    if (existing.storage_status !== "ready") {
      reusedRecord.storage_status = "pending";
      reusedRecord.last_error = null;
      reusedRecord.byte_size = null;
      reusedRecord.mime_type = null;
      reusedRecord.checksum = null;
      persistRecords.push(reusedRecord);
    }

    nextRecords.push(reusedRecord);
  }

  for (const [index, candidate] of (input.video_candidates ?? [])
    .filter((video) => video.download_mode === "direct_mp4")
    .entries()) {
    const sourceKey = getMediaSourceKey("video", candidate.source_url);
    const existing = existingBySourceKey.get(sourceKey);

    seenSourceKeys.add(sourceKey);

    if (existing === undefined) {
      const nextRecord = createPendingVideoRecord(xPostId, candidate, savedAt, input.media.length + index);
      nextRecords.push(nextRecord);
      persistRecords.push(nextRecord);
      continue;
    }

    const reusedRecord: MediaRecord = {
      ...existing,
      source_url: candidate.source_url,
      preview_image_url: candidate.thumbnail_url ?? candidate.poster_url,
      position: input.media.length + index,
      width: candidate.width,
      height: candidate.height,
      mime_type: candidate.mime_type
    };

    if (existing.storage_status !== "ready") {
      reusedRecord.storage_status = "pending";
      reusedRecord.last_error = null;
      reusedRecord.byte_size = null;
      reusedRecord.checksum = null;
      persistRecords.push(reusedRecord);
    }

    nextRecords.push(reusedRecord);
  }

  const removedRecords = existingMedia.filter(
    (media) => !seenSourceKeys.has(getMediaSourceKey(media.media_type, media.source_url))
  );
  const reusedRecords = nextRecords.filter((record) =>
    existingBySourceKey.has(getMediaSourceKey(record.media_type, record.source_url))
  );
  const newRecords = nextRecords.filter(
    (record) => !existingBySourceKey.has(getMediaSourceKey(record.media_type, record.source_url))
  );

  return {
    reusedRecords: dedupeMediaRecordsById(reusedRecords),
    newRecords: dedupeMediaRecordsById(newRecords),
    removedRecords: dedupeMediaRecordsById(removedRecords),
    persistRecords: dedupeMediaRecordsById(persistRecords)
  };
}

function normalizeDateFilterTarget(value: DateFilterTarget | null): DateFilterTarget | null {
  return value === "saved_at" || value === "posted_at" ? value : null;
}

function normalizeDateFilterTimestamp(value: number | null): number | null {
  if (!Number.isFinite(value) || value === null || value < 0) {
    return null;
  }

  return Math.floor(value);
}

function getMediaSourceKey(mediaType: MediaRecord["media_type"], sourceUrl: string): string {
  if (mediaType !== "image") {
    return `${mediaType}:${sourceUrl}`;
  }

  const canonicalSourceUrl = canonicalizeTwitterImageUrl(sourceUrl) ?? sourceUrl;
  return `${mediaType}:${canonicalSourceUrl}`;
}

function dedupeMediaRecordsById(records: MediaRecord[]): MediaRecord[] {
  const uniqueRecords = new Map<string, MediaRecord>();

  for (const record of records) {
    uniqueRecords.set(record.media_id, record);
  }

  return [...uniqueRecords.values()];
}

function normalizeArchiveTag(record: PostTagRecord): {
  x_post_id: string;
  tag: ArchiveTagRecord;
} {
  const displayName =
    record.source === "auto" ? cleanupTagName(record.display_name) : record.display_name;

  return {
    x_post_id: record.x_post_id,
    tag: {
      tag_id: record.tag_id,
      normalized_name: record.normalized_name,
      display_name: displayName,
      system_key: record.system_key ?? null,
      source: record.source
    }
  };
}

function sortArchiveTags(tags: ArchiveTagRecord[]): ArchiveTagRecord[] {
  return [...tags].sort((left, right) => {
    if (left.source !== right.source) {
      return left.source === "manual" ? -1 : 1;
    }

    return left.display_name.localeCompare(right.display_name);
  });
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

type PostTagInput = {
  x_post_id: string;
  normalized_name: string;
  display_name: string;
  system_key: BuiltInTagKey | null;
  source: TagSource;
  assigned_at: number;
};
