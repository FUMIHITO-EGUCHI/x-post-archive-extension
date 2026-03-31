import {
  addManualTagToArchivePost,
  deleteArchivePost,
  hasSavedPost,
  listArchivePosts,
  removeManualTagFromArchivePost,
  resumePendingMediaPersistence,
  saveArchivePost
} from "../archive/archive-service";
import type {
  DeletePostMessage,
  DeletePostResponse,
  HasPostResponse,
  ListPostsResponse,
  RuntimeErrorResponse,
  RuntimeMessage,
  RuntimeResponse,
  SavePostResponse,
  SavePostsBatchResponse,
  UpdatePostTagsResponse
} from "../../types/runtime";
import { createLogger, createRequestId } from "../logging/logger";

const logger = createLogger("runtime");

export async function handleRuntimeMessage(
  message: unknown
): Promise<RuntimeResponse | undefined> {
  await resumePendingMediaPersistence();

  if (!isRuntimeMessage(message)) {
    logger.warn("runtime.message.invalid");
    return undefined;
  }

  const requestId = createRequestId();

  logger.debug("runtime.message.received", {
    requestId,
    context: {
      type: message.type
    }
  });

  switch (message.type) {
    case "posts/save": {
      const result = await saveArchivePost(message.post);
      logger.info(
        result.status === "saved" ? "post.save.succeeded" : "post.save.duplicate",
        {
          requestId,
          context: {
            type: message.type,
            xPostId: message.post.x_post_id,
            mediaCount: message.post.media.length,
            videoCandidateCount: message.post.video_candidates?.length ?? 0
          }
        }
      );
      const response: SavePostResponse =
        result.post === undefined
          ? {
              type: "posts/save-result",
              status: result.status
            }
          : {
              type: "posts/save-result",
              status: result.status,
              post: result.post
            };
      return response;
    }

    case "posts/save-batch": {
      let saved = 0;
      let duplicates = 0;
      let failed = 0;

      for (const post of message.posts) {
        try {
          const result = await saveArchivePost(post);

          if (result.status === "saved") {
            saved += 1;
          } else {
            duplicates += 1;
          }
        } catch {
          failed += 1;
        }
      }

      logger.info("post.save_batch.completed", {
        requestId,
        context: {
          type: message.type,
          saved,
          duplicates,
          failed,
          requestedCount: message.posts.length
        }
      });

      const response: SavePostsBatchResponse = {
        type: "posts/save-batch-result",
        saved,
        duplicates,
        failed
      };
      return response;
    }

    case "posts/has": {
      const exists = await hasSavedPost(message.xPostId);
      logger.debug("post.has.completed", {
        requestId,
        context: {
          type: message.type,
          xPostId: message.xPostId,
          exists
        }
      });
      const response: HasPostResponse = {
        type: "posts/has-result",
        exists
      };
      return response;
    }

    case "posts/list": {
      const posts = await listArchivePosts();
      logger.debug("posts.list.completed", {
        requestId,
        context: {
          type: message.type,
          count: posts.length
        }
      });
      const response: ListPostsResponse = {
        type: "posts/list-result",
        posts
      };
      return response;
    }

    case "posts/delete": {
      const deleted = await deleteArchivePost(message.xPostId);
      logger.info("post.delete.completed", {
        requestId,
        context: {
          type: message.type,
          xPostId: message.xPostId,
          deleted
        }
      });
      const response: DeletePostResponse = {
        type: "posts/delete-result",
        deleted
      };
      return response;
    }

    case "posts/tags/add": {
      const tags = await addManualTagToArchivePost(message.xPostId, message.tagName);
      logger.info("post.tags.add.completed", {
        requestId,
        context: {
          type: message.type,
          xPostId: message.xPostId,
          tagName: message.tagName,
          tagCount: tags.length
        }
      });
      const response: UpdatePostTagsResponse = {
        type: "posts/tags/update-result",
        xPostId: message.xPostId,
        tags
      };
      return response;
    }

    case "posts/tags/remove": {
      const tags = await removeManualTagFromArchivePost(
        message.xPostId,
        message.normalizedTagName
      );
      logger.info("post.tags.remove.completed", {
        requestId,
        context: {
          type: message.type,
          xPostId: message.xPostId,
          normalizedTagName: message.normalizedTagName,
          tagCount: tags.length
        }
      });
      const response: UpdatePostTagsResponse = {
        type: "posts/tags/update-result",
        xPostId: message.xPostId,
        tags
      };
      return response;
    }
  }
}

function isRuntimeMessage(value: unknown): value is RuntimeMessage {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<RuntimeMessage>;
  return (
    candidate.type === "posts/save" ||
    candidate.type === "posts/save-batch" ||
    candidate.type === "posts/has" ||
    candidate.type === "posts/list" ||
    candidate.type === "posts/delete" ||
    candidate.type === "posts/tags/add" ||
    candidate.type === "posts/tags/remove"
  );
}

export function createRuntimeErrorResponse(error: unknown): RuntimeErrorResponse {
  return {
    type: "runtime/error",
    message: error instanceof Error ? error.message : "Unexpected runtime error."
  };
}
