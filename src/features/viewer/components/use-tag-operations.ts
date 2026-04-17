import { useEffect, useState } from "react";
import type { ArchivePostRecord } from "../../../types/archive";
import { createLogger } from "../../logging/logger";
import {
  requestAddPostTagByName,
  requestRemovePostTagByName
} from "../../runtime/client";

const logger = createLogger("tag-operations");

export function useTagOperations({
  posts,
  reloadCurrentArchive
}: {
  posts: ArchivePostRecord[];
  reloadCurrentArchive: () => Promise<void>;
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
      await requestAddPostTagByName(xPostId, displayName);
      await reloadCurrentArchive();
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
      await reloadCurrentArchive();
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
