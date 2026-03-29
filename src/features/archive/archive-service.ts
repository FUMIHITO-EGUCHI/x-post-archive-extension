import { archiveDb } from "../../db/archive-database";
import {
  addMediaRecords,
  deleteMediaRecordsByPostId,
  listMediaByPostId,
  listMediaByPostIds,
  updateMediaAfterWrite,
  updateMediaPreview
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
  SavePostInput,
  SaveVideoCandidateInput
} from "../../types/archive";
import {
  buildMediaOpfsPath,
  buildVideoPreviewOpfsPath,
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
  const imageMedia = input.media.map((image) =>
    createPendingImageRecord(input.x_post_id, image, savedAt)
  );
  const videoMedia = (input.video_candidates ?? [])
    .filter((candidate) => candidate.download_mode === "direct_mp4")
    .map((candidate, index) =>
      createPendingVideoRecord(input.x_post_id, candidate, savedAt, imageMedia.length + index)
    );
  const media = [...imageMedia, ...videoMedia];

  await archiveDb.transaction("rw", archiveDb.posts, archiveDb.media, async () => {
    await addPost(post);
    await addMediaRecords(media);
  });

  await Promise.all(media.map((record) => persistMedia(record)));

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
    const normalizedItem = normalizeMediaRecord(item);
    const current = mediaMap.get(normalizedItem.x_post_id);

    if (current === undefined) {
      mediaMap.set(normalizedItem.x_post_id, [normalizedItem]);
      continue;
    }

    current.push(normalizedItem);
  }

  return posts.map((post) => ({
    ...post,
    media: mediaMap.get(post.x_post_id) ?? []
  }));
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
      console.warn("Failed to delete OPFS media file.", {
        mediaId: item.media_id,
        xPostId,
        error
      });
    }

    if (typeof item.preview_image_opfs_path === "string") {
      try {
        await deleteBlobFromOpfs(item.preview_image_opfs_path);
      } catch (error) {
        console.warn("Failed to delete OPFS preview media file.", {
          mediaId: item.media_id,
          xPostId,
          error
        });
      }
    }
  }

  await archiveDb.transaction("rw", archiveDb.posts, archiveDb.media, async () => {
    await deleteMediaRecordsByPostId(xPostId);
    await deletePostRecord(xPostId);
  });

  return true;
}

async function persistMedia(record: MediaRecord): Promise<void> {
  try {
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
  } catch (error) {
    await updateMediaAfterWrite(record.media_id, {
      mime_type: null,
      byte_size: null,
      storage_status: "failed",
      last_error: error instanceof Error ? error.message : "Media persistence failed."
    });
  }
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

  if (
    input.video_candidates !== undefined &&
    !Array.isArray(input.video_candidates)
  ) {
    throw new Error("Invalid video candidate list.");
  }

  const directMp4Candidates = (input.video_candidates ?? []).filter(
    (candidate) => candidate.download_mode === "direct_mp4"
  );

  if (input.post_text.trim() === "" && input.media.length === 0 && directMp4Candidates.length === 0) {
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

function normalizeMediaRecord(media: MediaRecord): MediaRecord {
  return {
    ...media,
    preview_image_url: media.preview_image_url ?? null,
    preview_image_opfs_path: media.preview_image_opfs_path ?? null
  };
}
