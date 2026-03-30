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

export async function deletePostTag(postTagId: string): Promise<void> {
  await archiveDb.post_tags.delete(postTagId);
}

export async function deletePostTagsByPostId(xPostId: string): Promise<void> {
  await archiveDb.post_tags.where("x_post_id").equals(xPostId).delete();
}

export async function countPostTagLinksByTagId(tagId: string): Promise<number> {
  return archiveDb.post_tags.where("tag_id").equals(tagId).count();
}
