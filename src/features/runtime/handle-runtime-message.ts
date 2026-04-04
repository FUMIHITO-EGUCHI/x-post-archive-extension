import {
  addManualTagToArchivePost,
  deleteArchiveTagRedirect,
  deleteArchivePost,
  getArchiveSummary,
  listArchiveTagRedirectSummaries,
  hasSavedPost,
  listArchivePostsPage,
  listArchiveTagSummaries,
  listArchivePosts,
  mergeTags,
  renameTag,
  removeManualTagFromArchivePost,
  resumePendingMediaPersistence,
  saveArchivePost
} from "../archive/archive-service";
import { clearLogRecords } from "../../db/repositories/logs-repository";
import type {
  ClearLogsResponse,
  DeleteTagRedirectResponse,
  DeletePostMessage,
  DeletePostResponse,
  DebugLogMessage,
  GetArchiveSummaryResponse,
  HasPostResponse,
  ListTagRedirectsResponse,
  ListPostTagSummariesResponse,
  ListPostsPageResponse,
  ListPostsResponse,
  MergeTagsResponse,
  RenameTagResponse,
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
      const result = await saveArchivePost(
        message.post,
        message.traceId === undefined ? undefined : { traceId: message.traceId }
      );
      logger.info(
        result.status === "saved" ? "post.save.succeeded" : "post.save.duplicate",
        {
          requestId,
          context: {
            type: message.type,
            xPostId: message.post.x_post_id,
            mediaCount: message.post.media.length,
            videoCandidateCount: message.post.video_candidates?.length ?? 0,
            traceId: message.traceId ?? null
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
          const result = await saveArchivePost(
            post,
            message.traceId === undefined ? undefined : { traceId: message.traceId }
          );

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
          requestedCount: message.posts.length,
          traceId: message.traceId ?? null
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

    case "posts/list-page": {
      const result = await listArchivePostsPage(message.input);
      logger.debug("posts.list_page.completed", {
        requestId,
        context: {
          type: message.type,
          count: result.posts.length,
          totalCount: result.totalCount,
          hasMore: result.hasMore,
          offset: message.input.offset,
          limit: message.input.limit
        }
      });
      const response: ListPostsPageResponse = {
        type: "posts/list-page-result",
        posts: result.posts,
        totalCount: result.totalCount,
        nextOffset: result.nextOffset,
        hasMore: result.hasMore
      };
      return response;
    }

    case "posts/tags/list": {
      const tags = await listArchiveTagSummaries();
      logger.debug("posts.tags.list.completed", {
        requestId,
        context: {
          type: message.type,
          count: tags.length
        }
      });
      const response: ListPostTagSummariesResponse = {
        type: "posts/tags/list-result",
        tags
      };
      return response;
    }

    case "posts/summary": {
      const summary = await getArchiveSummary();
      logger.debug("posts.summary.completed", {
        requestId,
        context: {
          type: message.type,
          postCount: summary.postCount,
          mediaCount: summary.mediaCount
        }
      });
      const response: GetArchiveSummaryResponse = {
        type: "posts/summary-result",
        summary
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

    case "tag.rename": {
      const result = await renameTag(message.tagId, message.newDisplayName);
      logger.info("tags.rename.completed", {
        requestId,
        context: {
          type: message.type,
          tagId: message.tagId,
          ok: result.ok
        }
      });
      const response: RenameTagResponse = result.ok
        ? {
            type: "tag.rename",
            ok: true,
            tag: result.tag
          }
        : {
            type: "tag.rename",
            ok: false,
            error: "collision",
            conflictingTagId: result.conflictingTagId
          };
      return response;
    }

    case "tag.merge": {
      const result = await mergeTags(
        message.sourceTagId,
        message.targetTagId,
        message.preserveFutureTagUses
      );
      logger.info("tags.merge.completed", {
        requestId,
        context: {
          type: message.type,
          sourceTagId: message.sourceTagId,
          targetTagId: message.targetTagId,
          preserveFutureTagUses: message.preserveFutureTagUses,
          mergedPostCount: result.mergedPostCount,
          removedDuplicateCount: result.removedDuplicateCount
        }
      });
      const response: MergeTagsResponse = {
        type: "tag.merge",
        mergedPostCount: result.mergedPostCount,
        removedDuplicateCount: result.removedDuplicateCount
      };
      return response;
    }

    case "tag.redirects.list": {
      const redirects = await listArchiveTagRedirectSummaries();
      logger.debug("tags.redirects.list.completed", {
        requestId,
        context: {
          type: message.type,
          count: redirects.length
        }
      });
      const response: ListTagRedirectsResponse = {
        type: "tag.redirects.list",
        redirects
      };
      return response;
    }

    case "tag.redirects.delete": {
      const deleted = await deleteArchiveTagRedirect(message.tagRedirectId);
      logger.info("tags.redirects.delete.completed", {
        requestId,
        context: {
          type: message.type,
          tagRedirectId: message.tagRedirectId,
          deleted
        }
      });
      const response: DeleteTagRedirectResponse = {
        type: "tag.redirects.delete",
        deleted
      };
      return response;
    }

    case "logs/clear": {
      await clearLogRecords();
      const response: ClearLogsResponse = {
        type: "logs/clear-result",
        deleted: true
      };
      return response;
    }

    case "debug/log": {
      writeDebugLog(message, requestId);
      return undefined;
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
    candidate.type === "posts/list-page" ||
    candidate.type === "posts/tags/list" ||
    candidate.type === "posts/summary" ||
    candidate.type === "posts/delete" ||
    candidate.type === "posts/tags/add" ||
    candidate.type === "posts/tags/remove" ||
    candidate.type === "tag.rename" ||
    candidate.type === "tag.merge" ||
    candidate.type === "tag.redirects.list" ||
    candidate.type === "tag.redirects.delete" ||
    candidate.type === "logs/clear" ||
    candidate.type === "debug/log"
  );
}

function writeDebugLog(message: DebugLogMessage, requestId: string): void {
  const logOptions = {
    requestId,
    ...(message.message === undefined ? {} : { message: message.message }),
    context: {
      ...(message.context ?? {}),
      traceId: message.traceId ?? null
    }
  };

  switch (message.level) {
    case "debug":
      logger.debug(message.event, logOptions);
      return;
    case "info":
      logger.info(message.event, logOptions);
      return;
    case "warn":
      logger.warn(message.event, logOptions);
      return;
    case "error":
      logger.error(message.event, logOptions);
      return;
    default:
      assertNever(message.level);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled log level: ${String(value)}`);
}

export function createRuntimeErrorResponse(error: unknown): RuntimeErrorResponse {
  return {
    type: "runtime/error",
    message: error instanceof Error ? error.message : "Unexpected runtime error."
  };
}
