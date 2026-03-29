import { archiveDb } from "../archive-database";
import type { MediaRecord } from "../../types/archive";

export async function addMediaRecords(records: MediaRecord[]): Promise<void> {
  if (records.length === 0) {
    return;
  }

  await archiveDb.media.bulkAdd(records);
}

export async function listMediaByPostId(xPostId: string): Promise<MediaRecord[]> {
  const media = await archiveDb.media.where("x_post_id").equals(xPostId).toArray();
  return sortMediaByPosition(media);
}

export async function listMediaByPostIds(xPostIds: string[]): Promise<MediaRecord[]> {
  if (xPostIds.length === 0) {
    return [];
  }

  const media = await archiveDb.media.where("x_post_id").anyOf(xPostIds).toArray();
  return sortMediaByPostAndPosition(media);
}

export async function updateMediaAfterWrite(
  mediaId: string,
  update: Pick<MediaRecord, "mime_type" | "byte_size" | "storage_status" | "last_error">
): Promise<void> {
  await archiveDb.media.update(mediaId, update);
}

export async function updateMediaPreview(
  mediaId: string,
  update: Pick<MediaRecord, "preview_image_opfs_path">
): Promise<void> {
  await archiveDb.media.update(mediaId, update);
}

export async function deleteMediaRecordsByPostId(xPostId: string): Promise<void> {
  await archiveDb.media.where("x_post_id").equals(xPostId).delete();
}

function sortMediaByPosition(media: MediaRecord[]): MediaRecord[] {
  return [...media].sort((left, right) => left.position - right.position);
}

function sortMediaByPostAndPosition(media: MediaRecord[]): MediaRecord[] {
  return [...media].sort((left, right) => {
    if (left.x_post_id === right.x_post_id) {
      return left.position - right.position;
    }

    return left.x_post_id.localeCompare(right.x_post_id);
  });
}
