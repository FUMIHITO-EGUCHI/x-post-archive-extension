import { archiveDb } from "../archive-database";
import type { TagRedirectRecord } from "../../types/archive";

export async function getTagRedirectBySourceNormalizedName(
  sourceNormalizedName: string
): Promise<TagRedirectRecord | undefined> {
  return archiveDb.tag_redirects.where("source_normalized_name").equals(sourceNormalizedName).first();
}

export async function listTagRedirects(): Promise<TagRedirectRecord[]> {
  return archiveDb.tag_redirects.orderBy("created_at").toArray();
}

export async function listTagRedirectsByTargetTagId(targetTagId: string): Promise<TagRedirectRecord[]> {
  return archiveDb.tag_redirects.where("target_tag_id").equals(targetTagId).toArray();
}

export async function putTagRedirect(record: TagRedirectRecord): Promise<void> {
  await archiveDb.tag_redirects.put(record);
}

export async function deleteTagRedirectById(tagRedirectId: string): Promise<void> {
  await archiveDb.tag_redirects.delete(tagRedirectId);
}
