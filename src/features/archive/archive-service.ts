import { archiveDb } from "../../db/archive-database";
import {
  addMediaRecords,
  listMediaByStorageStatus,
  deleteMediaRecordsByPostId,
  listMediaByPostId,
  listMediaByPostIds,
  markMediaPending,
  updateMediaAfterWrite,
  updateMediaPreview
} from "../../db/repositories/media-repository";
import {
  addPost,
  countPosts,
  deletePostRecord,
  getPost,
  hasPost,
  listPosts,
  listPostsSliceBySort
} from "../../db/repositories/posts-repository";
import {
  addPostTag,
  countPostTagLinksByTagId,
  deletePostTag,
  deletePostTagsByPostId,
  getPostTagByNormalizedName,
  listAllPostTags,
  listPostIdsByNormalizedName,
  listPostTagsByPostId,
  listPostTagsByPostIds
} from "../../db/repositories/post-tags-repository";
import {
  addTag,
  deleteTagsByIds,
  getTagByNormalizedName
} from "../../db/repositories/tags-repository";
import type {
  ArchivePostRecord,
  ArchiveTagRecord,
  MediaRecord,
  PostRecord,
  PostTagRecord,
  SaveImageInput,
  SavePostInput,
  SaveVideoCandidateInput,
  TagRecord,
  TagSource
} from "../../types/archive";
import type {
  ArchiveSummaryRecord,
  ArchiveTagSummaryRecord,
  ListPostsPageInput
} from "../../types/viewer";
import {
  buildMediaOpfsPath,
  buildVideoPreviewOpfsPath,
  deleteBlobFromOpfs,
  writeBlobToOpfs
} from "../media-storage/opfs-media-storage";
import { createLogger } from "../logging/logger";

const PENDING_MEDIA_RESUME_BATCH_SIZE = 24;
const activeMediaPersistenceIds = new Set<string>();
let pendingResumePromise: Promise<void> | null = null;
const logger = createLogger("archive-service");

export async function hasSavedPost(xPostId: string): Promise<boolean> {
  return hasPost(xPostId);
}

export async function saveArchivePost(input: SavePostInput): Promise<{
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

  if (existing !== undefined) {
    const duplicateMediaWork = await prepareDuplicateMediaWork(input);

    logger.info("post.save.duplicate_detected", {
      context: {
        xPostId: input.x_post_id,
        newMediaCount: duplicateMediaWork.newRecords.length,
        retryMediaCount: duplicateMediaWork.retryRecords.length
      }
    });

    if (autoTags.length > 0) {
      await archiveDb.transaction(
        "rw",
        archiveDb.media,
        archiveDb.tags,
        archiveDb.post_tags,
        async () => {
          if (duplicateMediaWork.newRecords.length > 0) {
            await addMediaRecords(duplicateMediaWork.newRecords);
          }

          for (const media of duplicateMediaWork.retryRecords) {
            await markMediaPending(media.media_id);
          }

          await ensureTagAssignments(autoTags);
        }
      );
    } else if (duplicateMediaWork.newRecords.length > 0 || duplicateMediaWork.retryRecords.length > 0) {
      await archiveDb.transaction("rw", archiveDb.media, async () => {
        if (duplicateMediaWork.newRecords.length > 0) {
          await addMediaRecords(duplicateMediaWork.newRecords);
        }

        for (const media of duplicateMediaWork.retryRecords) {
          await markMediaPending(media.media_id);
        }
      });
    }

    if (duplicateMediaWork.persistRecords.length > 0) {
      enqueueMediaPersistence(duplicateMediaWork.persistRecords);
    }

    return {
      status: "duplicate",
      post: existing
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
  await archiveDb.transaction(
    "rw",
    archiveDb.posts,
    archiveDb.media,
    archiveDb.tags,
    archiveDb.post_tags,
    async () => {
      await addPost(post);
      await addMediaRecords(media);
      await ensureTagAssignments(autoTags);
    }
  );

  enqueueMediaPersistence(media);

  logger.info("post.save.persisted", {
    context: {
      xPostId: post.x_post_id,
      mediaCount: media.length,
      autoTagCount: autoTags.length
    }
  });

  return {
    status: "saved",
    post
  };
}

export async function listArchivePosts(): Promise<ArchivePostRecord[]> {
  const posts = await listPosts();

  if (posts.length === 0) {
    return [];
  }

  return hydrateArchivePosts(posts);
}

export async function listArchivePostsPage(
  input: ListPostsPageInput
): Promise<{
  posts: ArchivePostRecord[];
  totalCount: number;
  hasMore: boolean;
  nextOffset: number;
}> {
  const normalizedOffset = normalizePageOffset(input.offset);
  const normalizedLimit = normalizePageLimit(input.limit);
  const matchingPostIds =
    input.tagFilter === null ? null : new Set(await listPostIdsByNormalizedName(input.tagFilter));
  const totalCount = matchingPostIds === null ? await countPosts() : matchingPostIds.size;

  if (totalCount === 0) {
    return {
      posts: [],
      totalCount: 0,
      hasMore: false,
      nextOffset: normalizedOffset
    };
  }

  const pagePosts =
    matchingPostIds === null
      ? await listPostsSliceBySort(
          input.sortField,
          input.sortDirection,
          normalizedOffset,
          normalizedLimit
        )
      : await listTaggedPostsPage(input, matchingPostIds, normalizedOffset, normalizedLimit);

  return {
    posts: await hydrateArchivePosts(pagePosts),
    totalCount,
    hasMore: normalizedOffset + pagePosts.length < totalCount,
    nextOffset: normalizedOffset + pagePosts.length
  };
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

export async function getArchiveSummary(): Promise<ArchiveSummaryRecord> {
  const [posts, media, postTags] = await Promise.all([
    listPosts(),
    archiveDb.media.toArray(),
    listAllPostTags()
  ]);

  let imageCount = 0;
  let videoCount = 0;
  let mediaBytes = 0;
  const usernames = new Set<string>();
  const tagNames = new Set<string>();

  for (const post of posts) {
    usernames.add(post.x_username);
  }

  for (const item of media) {
    if (item.media_type === "image") {
      imageCount += 1;
    } else if (item.media_type === "video") {
      videoCount += 1;
    }

    mediaBytes += item.byte_size ?? 0;
  }

  for (const record of postTags) {
    tagNames.add(record.normalized_name);
  }

  return {
    postCount: posts.length,
    imageCount,
    videoCount,
    mediaCount: imageCount + videoCount,
    accountCount: usernames.size,
    tagCount: tagNames.size,
    mediaBytes
  };
}

export async function addManualTagToArchivePost(
  xPostId: string,
  tagName: string
): Promise<ArchiveTagRecord[]> {
  const post = await getPost(xPostId);

  if (post === undefined) {
    throw new Error("Post not found.");
  }

  const prepared = createPostTagInput(xPostId, tagName, "manual");

  await archiveDb.transaction(
    "rw",
    archiveDb.tags,
    archiveDb.post_tags,
    async () => {
      await ensureTagAssignments([prepared]);
    }
  );

  const tags = await listArchiveTagsForPost(xPostId);

  logger.info("post.tags.manual_added", {
    context: {
      xPostId,
      tagName,
      tagCount: tags.length
    }
  });

  return tags;
}

export async function removeManualTagFromArchivePost(
  xPostId: string,
  normalizedTagName: string
): Promise<ArchiveTagRecord[]> {
  const normalizedName = normalizeTagName(normalizedTagName);

  if (normalizedName === null) {
    throw new Error("Invalid tag name.");
  }

  const record = await getPostTagByNormalizedName(xPostId, normalizedName);

  if (record === undefined) {
    return listArchiveTagsForPost(xPostId);
  }

  if (record.source !== "manual") {
    throw new Error("Auto tags cannot be removed manually.");
  }

  await archiveDb.transaction(
    "rw",
    archiveDb.tags,
    archiveDb.post_tags,
    async () => {
      await deletePostTag(record.post_tag_id);
      await deleteOrphanedTag(record.tag_id);
    }
  );

  const tags = await listArchiveTagsForPost(xPostId);

  logger.info("post.tags.manual_removed", {
    context: {
      xPostId,
      normalizedTagName,
      tagCount: tags.length
    }
  });

  return tags;
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

async function persistMedia(record: MediaRecord): Promise<void> {
  if (activeMediaPersistenceIds.has(record.media_id)) {
    return;
  }

  activeMediaPersistenceIds.add(record.media_id);

  try {
    logger.info("media.persist.started", {
      context: {
        mediaId: record.media_id,
        xPostId: record.x_post_id,
        mediaType: record.media_type
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

    await writeBlobToOpfs(record.opfs_path, blob);
    await updateMediaAfterWrite(record.media_id, {
      mime_type: mimeType === null || mimeType.trim() === "" ? null : mimeType,
      byte_size: blob.size,
      storage_status: "ready",
      last_error: null
    });

    logger.info("media.persist.succeeded", {
      context: {
        mediaId: record.media_id,
        xPostId: record.x_post_id,
        mediaType: record.media_type,
        byteSize: blob.size
      }
    });
  } catch (error) {
    await updateMediaAfterWrite(record.media_id, {
      mime_type: null,
      byte_size: null,
      storage_status: "failed",
      last_error: error instanceof Error ? error.message : "Media persistence failed."
    });

    logger.error("media.persist.failed", {
      message: "Media persistence failed.",
      context: {
        mediaId: record.media_id,
        xPostId: record.x_post_id,
        mediaType: record.media_type,
        error
      }
    });
  } finally {
    activeMediaPersistenceIds.delete(record.media_id);
  }
}

function enqueueMediaPersistence(media: MediaRecord[]): void {
  if (media.length === 0) {
    return;
  }

  logger.debug("media.persist.enqueued", {
    context: {
      count: media.length
    }
  });

  void Promise.allSettled(media.map((record) => persistMedia(record))).then((results) => {
    for (const [index, result] of results.entries()) {
      if (result.status === "fulfilled") {
        continue;
      }

      logger.error("media.persist.queue_failed", {
        message: "Queued media persistence failed unexpectedly.",
        context: {
          mediaId: media[index]?.media_id,
          xPostId: media[index]?.x_post_id,
          reason: result.reason
        }
      });
    }
  });
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

async function listArchiveTagsForPost(xPostId: string): Promise<ArchiveTagRecord[]> {
  const postTags = await listPostTagsByPostId(xPostId);
  return sortArchiveTags(postTags.map((item) => normalizeArchiveTag(item).tag));
}

async function hydrateArchivePosts(posts: PostRecord[]): Promise<ArchivePostRecord[]> {
  const postIds = posts.map((post) => post.x_post_id);
  const media = await listMediaByPostIds(postIds);
  const postTags = await listPostTagsByPostIds(postIds);
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

  return posts.map((post) => ({
    ...post,
    media: mediaMap.get(post.x_post_id) ?? [],
    tags: sortArchiveTags(tagMap.get(post.x_post_id) ?? [])
  }));
}

async function listTaggedPostsPage(
  input: ListPostsPageInput,
  matchingPostIds: Set<string>,
  offset: number,
  limit: number
): Promise<PostRecord[]> {
  const results: PostRecord[] = [];
  const scanChunkSize = Math.max(limit * 3, 100);
  let skippedMatches = 0;
  let scanOffset = 0;

  while (results.length < limit) {
    const chunk = await listPostsSliceBySort(
      input.sortField,
      input.sortDirection,
      scanOffset,
      scanChunkSize
    );

    if (chunk.length === 0) {
      break;
    }

    scanOffset += chunk.length;

    for (const post of chunk) {
      if (!matchingPostIds.has(post.x_post_id)) {
        continue;
      }

      if (skippedMatches < offset) {
        skippedMatches += 1;
        continue;
      }

      results.push(post);

      if (results.length >= limit) {
        break;
      }
    }
  }

  return results;
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

async function ensureTagAssignments(inputs: PostTagInput[]): Promise<void> {
  for (const item of inputs) {
    const existingPostTag = await getPostTagByNormalizedName(item.x_post_id, item.normalized_name);

    if (existingPostTag !== undefined) {
      if (existingPostTag.source === "auto" && item.source === "manual") {
        await deletePostTag(existingPostTag.post_tag_id);
        await deleteOrphanedTag(existingPostTag.tag_id);
      } else {
        continue;
      }
    }

    const tag = await ensureTagRecord(item.normalized_name, item.display_name, item.assigned_at);

    await addPostTag({
      post_tag_id: crypto.randomUUID(),
      x_post_id: item.x_post_id,
      tag_id: tag.tag_id,
      normalized_name: tag.normalized_name,
      display_name: item.display_name,
      source: item.source,
      assigned_at: item.assigned_at
    });
  }
}

async function ensureTagRecord(
  normalizedName: string,
  displayName: string,
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
    created_at: createdAt
  };

  await addTag(record);
  return record;
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

  return {
    media_id: mediaId,
    x_post_id: xPostId,
    media_type: "image",
    source_url: image.source_url,
    preview_image_url: null,
    preview_image_opfs_path: null,
    opfs_path: buildMediaOpfsPath(xPostId, mediaId, "image"),
    position: image.position,
    alt_text: image.alt_text,
    width: image.width,
    height: image.height,
    mime_type: null,
    byte_size: null,
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
    preview_image_opfs_path: media.preview_image_opfs_path ?? null
  };
}

function getMediaSourceKey(mediaType: MediaRecord["media_type"], sourceUrl: string): string {
  return `${mediaType}:${sourceUrl}`;
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

type PostTagInput = {
  x_post_id: string;
  normalized_name: string;
  display_name: string;
  source: TagSource;
  assigned_at: number;
};
