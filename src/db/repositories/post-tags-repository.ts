import { archiveDb } from "../archive-database";
import type { PostTagRecord } from "../../types/archive";

export async function addPostTag(record: PostTagRecord): Promise<void> {
  await archiveDb.post_tags.add(record);
}

export async function getPostTagByNormalizedName(
  xPostId: string,
  normalizedName: string
): Promise<PostTagRecord | undefined> {
  return archiveDb.post_tags
    .where("[x_post_id+normalized_name]")
    .equals([xPostId, normalizedName])
    .first();
}

export async function listPostTagsByPostIds(xPostIds: string[]): Promise<PostTagRecord[]> {
  if (xPostIds.length === 0) {
    return [];
  }

  return archiveDb.post_tags.where("x_post_id").anyOf(xPostIds).sortBy("assigned_at");
}

export async function listPostTagsByPostId(xPostId: string): Promise<PostTagRecord[]> {
  return archiveDb.post_tags.where("x_post_id").equals(xPostId).sortBy("assigned_at");
}

export async function listPostTagsByTagId(tagId: string): Promise<PostTagRecord[]> {
  return archiveDb.post_tags.where("tag_id").equals(tagId).sortBy("assigned_at");
}

export async function listPostIdsByTagId(tagId: string): Promise<string[]> {
  const records = await archiveDb.post_tags.where("tag_id").equals(tagId).toArray();
  return records.map((record) => record.x_post_id);
}

export async function listPostIdsByNormalizedName(normalizedName: string): Promise<string[]> {
  const records = await archiveDb.post_tags
    .where("normalized_name")
    .equals(normalizedName)
    .toArray();

  return records.map((record) => record.x_post_id);
}

export async function listAllPostTags(): Promise<PostTagRecord[]> {
  return archiveDb.post_tags.toArray();
}

export async function countAssignedTagNames(): Promise<number> {
  return (await archiveDb.post_tags.orderBy("normalized_name").uniqueKeys()).length;
}

export async function deletePostTag(postTagId: string): Promise<void> {
  await archiveDb.post_tags.delete(postTagId);
}

export async function deletePostTagsByPostId(xPostId: string): Promise<void> {
  await archiveDb.post_tags.where("x_post_id").equals(xPostId).delete();
}

export async function countPostTagLinksByTagId(tagId: string): Promise<number> {
  return archiveDb.post_tags.where("tag_id").equals(tagId).count();
}

export async function bulkAddPostTagRecords(records: PostTagRecord[]): Promise<number> {
  if (records.length === 0) {
    return 0;
  }

  const existing = await archiveDb.post_tags
    .where("[x_post_id+normalized_name]")
    .anyOf(
      records.map(
        (record) => [record.x_post_id, record.normalized_name] as [string, string]
      )
    )
    .toArray();
  const existingKeys = new Set(
    existing.map((record) => `${record.x_post_id}::${record.normalized_name}`)
  );
  const toAdd = records.filter(
    (record) => !existingKeys.has(`${record.x_post_id}::${record.normalized_name}`)
  );

  if (toAdd.length > 0) {
    await archiveDb.post_tags.bulkAdd(toAdd);
  }

  return toAdd.length;
}
