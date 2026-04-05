import {
  archiveDb,
  hasArchiveObjectStore,
  isMissingObjectStoreError
} from "../archive-database";
import type { TagRedirectRecord } from "../../types/archive";

export async function getTagRedirectBySourceNormalizedName(
  sourceNormalizedName: string
): Promise<TagRedirectRecord | undefined> {
  if (!(await hasArchiveObjectStore("tag_redirects"))) {
    return undefined;
  }

  try {
    return archiveDb.tag_redirects
      .where("source_normalized_name")
      .equals(sourceNormalizedName)
      .first();
  } catch (error) {
    if (isMissingObjectStoreError(error)) {
      return undefined;
    }

    throw error;
  }
}

export async function listTagRedirects(): Promise<TagRedirectRecord[]> {
  if (!(await hasArchiveObjectStore("tag_redirects"))) {
    return [];
  }

  try {
    return archiveDb.tag_redirects.orderBy("created_at").toArray();
  } catch (error) {
    if (isMissingObjectStoreError(error)) {
      return [];
    }

    throw error;
  }
}

export async function listTagRedirectsByTargetTagId(targetTagId: string): Promise<TagRedirectRecord[]> {
  if (!(await hasArchiveObjectStore("tag_redirects"))) {
    return [];
  }

  try {
    return archiveDb.tag_redirects.where("target_tag_id").equals(targetTagId).toArray();
  } catch (error) {
    if (isMissingObjectStoreError(error)) {
      return [];
    }

    throw error;
  }
}

export async function putTagRedirect(record: TagRedirectRecord): Promise<void> {
  if (!(await hasArchiveObjectStore("tag_redirects"))) {
    return;
  }

  try {
    await archiveDb.tag_redirects.put(record);
  } catch (error) {
    if (isMissingObjectStoreError(error)) {
      return;
    }

    throw error;
  }
}

export async function deleteTagRedirectById(tagRedirectId: string): Promise<void> {
  if (!(await hasArchiveObjectStore("tag_redirects"))) {
    return;
  }

  try {
    await archiveDb.tag_redirects.delete(tagRedirectId);
  } catch (error) {
    if (isMissingObjectStoreError(error)) {
      return;
    }

    throw error;
  }
}
