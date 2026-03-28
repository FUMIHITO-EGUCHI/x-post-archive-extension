import { archiveDb } from "../../db/archive-database";
import {
  addMediaRecords,
  deleteMediaRecordsByPostId,
  listMediaByPostId,
  listMediaByPostIds,
  updateMediaAfterWrite
} from "../../db/repositories/media-repository";
import {
  addPost,
  deletePostRecord,
  getPost,
  hasPost,
  listPosts
} from "../../db/repositories/posts-repository";
import type {
  ArchivePostRecord,
  MediaRecord,
  PostRecord,
  SaveImageInput,
  SavePostInput
} from "../../types/archive";
import {
  buildMediaOpfsPath,
  deleteBlobFromOpfs,
  writeBlobToOpfs
} from "../media-storage/opfs-media-storage";

export async function hasSavedPost(xPostId: string): Promise<boolean> {
  return hasPost(xPostId);
}

export async function saveArchivePost(input: SavePostInput): Promise<{
  status: "saved" | "duplicate";
  post?: PostRecord;
}> {
  validateSavePostInput(input);

  const existing = await getPost(input.x_post_id);

  if (existing !== undefined) {
    return {
      status: "duplicate",
      post: existing
    };
  }

  const savedAt = Date.now();
  const post: PostRecord = {
    x_post_id: input.x_post_id,
    x_username: input.x_username.trim(),
    post_text: input.post_text.trim(),
    post_url: input.post_url.trim(),
    saved_at: savedAt
  };
  const media = input.media.map((image) => createPendingMediaRecord(input.x_post_id, image, savedAt));

  await archiveDb.transaction("rw", archiveDb.posts, archiveDb.media, async () => {
    await addPost(post);
    await addMediaRecords(media);
  });

  await Promise.all(media.map((record) => persistImage(record)));

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

  const media = await listMediaByPostIds(posts.map((post) => post.x_post_id));
  const mediaMap = new Map<string, MediaRecord[]>();

  for (const item of media) {
    const current = mediaMap.get(item.x_post_id);

    if (current === undefined) {
      mediaMap.set(item.x_post_id, [item]);
      continue;
    }

    current.push(item);
  }

  return posts.map((post) => ({
    ...post,
    media: mediaMap.get(post.x_post_id) ?? []
  }));
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
      console.warn("Failed to delete OPFS media file.", {
        mediaId: item.media_id,
        xPostId,
        error
      });
    }
  }

  await archiveDb.transaction("rw", archiveDb.posts, archiveDb.media, async () => {
    await deleteMediaRecordsByPostId(xPostId);
    await deletePostRecord(xPostId);
  });

  return true;
}

async function persistImage(record: MediaRecord): Promise<void> {
  try {
    const response = await fetch(record.source_url, {
      credentials: "omit"
    });

    if (!response.ok) {
      throw new Error(`Image fetch failed with status ${response.status}.`);
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
  } catch (error) {
    await updateMediaAfterWrite(record.media_id, {
      mime_type: null,
      byte_size: null,
      storage_status: "failed",
      last_error: error instanceof Error ? error.message : "Image persistence failed."
    });
  }
}

function createPendingMediaRecord(
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
    opfs_path: buildMediaOpfsPath(xPostId, mediaId),
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

function validateSavePostInput(input: SavePostInput): void {
  requireNonEmptyString(input.x_post_id, "x_post_id");
  requireNonEmptyString(input.x_username, "x_username");
  requireNonEmptyString(input.post_url, "post_url");

  if (typeof input.post_text !== "string") {
    throw new Error("Invalid post_text.");
  }

  if (!Array.isArray(input.media)) {
    throw new Error("Invalid media list.");
  }

  if (input.post_text.trim() === "" && input.media.length === 0) {
    throw new Error("A post without text must include at least one image.");
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
