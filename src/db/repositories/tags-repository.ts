import { archiveDb } from "../archive-database";
import type { TagRecord } from "../../types/archive";

export async function getTagByNormalizedName(
  normalizedName: string
): Promise<TagRecord | undefined> {
  return archiveDb.tags.where("normalized_name").equals(normalizedName).first();
}

export async function addTag(record: TagRecord): Promise<void> {
  await archiveDb.tags.add(record);
}

export async function deleteTagsByIds(tagIds: string[]): Promise<void> {
  if (tagIds.length === 0) {
    return;
  }

  await archiveDb.tags.bulkDelete(tagIds);
}
