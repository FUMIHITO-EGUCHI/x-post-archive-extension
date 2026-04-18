import { useEffect, useState } from "react";
import type { ArchivePostRecord, ArchiveTagRecord, PostTagRecord } from "../../../types/archive";
import { createLogger } from "../../logging/logger";
import {
  requestAddPostTagByName,
  requestRemovePostTagByName
} from "../../runtime/client";

const logger = createLogger("tag-operations");

export function useTagOperations({
  activeTagFilter,
  posts,
  refreshArchiveMetadata,
  removePostFromCurrentPage,
  reloadCurrentArchive,
  updatePostTags
}: {
  activeTagFilter: string | null;
  posts: ArchivePostRecord[];
  refreshArchiveMetadata: () => Promise<void>;
  removePostFromCurrentPage: (xPostId: string) => void;
  reloadCurrentArchive: () => Promise<void>;
  updatePostTags: (
    xPostId: string,
    updateTags: (tags: ArchiveTagRecord[]) => ArchiveTagRecord[]
  ) => void;
}) {
  const [tagActionPostId, setTagActionPostId] = useState<string | null>(null);
  const [tagPickerPostId, setTagPickerPostId] = useState<string | null>(null);

  useEffect(() => {
    if (tagPickerPostId === null) {
      return;
    }

    if (!posts.some((post) => post.x_post_id === tagPickerPostId)) {
      setTagPickerPostId(null);
    }
  }, [posts, tagPickerPostId]);

  async function handleAddTagToPost(xPostId: string, displayName: string) {
    if (displayName.trim() === "") {
      return;
    }

    setTagActionPostId(xPostId);

    try {
      const response = await requestAddPostTagByName(xPostId, displayName);

      if (response.ok) {
        updatePostTags(xPostId, (tags) => addOrReplaceTag(tags, response.postTag));
        await refreshArchiveMetadata();
      } else {
        await reloadCurrentArchive();
      }
    } catch (error) {
      logger.error("post.tags.add.failed", {
        message: "Failed to add tag.",
        context: {
          xPostId,
          displayName,
          error
        }
      });
    } finally {
      setTagActionPostId(null);
    }
  }

  async function handleRemoveTagFromPost(xPostId: string, normalizedName: string) {
    setTagActionPostId(xPostId);

    try {
      await requestRemovePostTagByName(xPostId, normalizedName);

      if (activeTagFilter === normalizedName) {
        removePostFromCurrentPage(xPostId);
      } else {
        updatePostTags(xPostId, (tags) =>
          tags.filter((tag) => tag.normalized_name !== normalizedName)
        );
      }

      await refreshArchiveMetadata();
    } catch (error) {
      logger.error("post.tags.remove.failed", {
        message: "Failed to remove tag.",
        context: {
          xPostId,
          normalizedTagName: normalizedName,
          error
        }
      });
    } finally {
      setTagActionPostId(null);
    }
  }

  return {
    tagActionPostId,
    tagPickerPostId,
    setTagPickerPostId,
    handleAddTagToPost,
    handleRemoveTagFromPost
  };
}

function addOrReplaceTag(
  tags: ArchiveTagRecord[],
  postTag: PostTagRecord
): ArchiveTagRecord[] {
  const nextTag: ArchiveTagRecord = {
    tag_id: postTag.tag_id,
    normalized_name: postTag.normalized_name,
    display_name: postTag.display_name,
    system_key: postTag.system_key,
    source: postTag.source
  };
  const existingIndex = tags.findIndex(
    (tag) => tag.normalized_name === nextTag.normalized_name
  );

  if (existingIndex === -1) {
    return [...tags, nextTag];
  }

  return tags.map((tag, index) => (index === existingIndex ? nextTag : tag));
}
