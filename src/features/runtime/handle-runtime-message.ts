import {
  addPostTagByName,
  bulkAssignTagApplyBatch,
  bulkAssignTagPreview,
  deleteArchiveTagRedirect,
  deleteArchivePost,
  getArchiveSummary,
  getThreadExpandQueueSummary,
  hydrateThreadTree,
  listArchiveTagRedirectSummaries,
  listArchiveUserSummaries,
  hasSavedPost,
  listArchivePostsPage,
  listArchiveTagSummaries,
  mergeTags,
  renameTag,
  removePostTagByName,
  retryThreadExpandQueue,
  resumePendingMediaPersistence,
  saveArchivePost,
  saveThread
} from "../archive/archive-service";
import { resumeThreadExpandProcessing } from "../archive/thread-expand-worker";
import { resetExtensionState } from "../archive/archive-maintenance-service";
import {
  cancelRefetch,
  clearRefetchQueue,
  completeRefetchFromContentScript,
  enqueueRefetchPosts,
  getRefetchStatus,
  resumeRefetchProcessing
} from "../refetch/refetch-coordinator";
import { clearLogRecords } from "../../db/repositories/logs-repository";
import {
  getTweetDetailTemplate,
  setTweetDetailTemplate
} from "../../db/repositories/thread-repository";
import { fetchTweetDetail } from "../x/tweet-detail-client";
import type {
  AddPostTagByNameResponse,
  BulkAssignTagApplyBatchResponse,
  BulkAssignTagPreviewResponse,
  ClearLogsResponse,
  DeleteTagRedirectResponse,
  DeletePostMessage,
  DeletePostResponse,
  DebugLogMessage,
  FetchTweetDetailResponse,
  GetArchiveSummaryResponse,
  GetThreadResponse,
  GetThreadExpandQueueStatusResponse,
  HasPostResponse,
  ListTagRedirectsResponse,
  ListPostTagSummariesResponse,
  ListPostsPageResponse,
  UserSummariesResponse,
  MergeTagsResponse,
  RenameTagResponse,
  RemovePostTagByNameResponse,
  RefetchCancelResponse,
  RefetchClearResponse,
  RefetchCompleteResponse,
  RefetchEnqueueResponse,
  RefetchStatusResponse,
  ResetArchiveResponse,
  RuntimeErrorResponse,
  RuntimeMessage,
  RuntimeResponse,
  RetryThreadExpandResponse,
  SavePostResponse,
  SavePostsBatchResponse,
  SaveThreadResponse,
  SetTweetDetailTemplateResponse
} from "../../types/runtime";
import { createLogger, createRequestId } from "../logging/logger";

const logger = createLogger("runtime");

export async function handleRuntimeMessage(
  message: unknown,
  sender:
    | {
        tab?: {
          id?: number;
        };
      }
    | undefined = undefined
): Promise<RuntimeResponse | undefined> {
  await resumePendingMediaPersistence();

  if (!isRuntimeMessage(message)) {
    logger.warn("runtime.message.invalid");
    return undefined;
  }

  if (message.type !== "refetch.cancel" && message.type !== "refetch.clear") {
    void resumeRefetchProcessing();
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

    case "posts/save-thread": {
      const result = await saveThread(
        message.posts,
        message.traceId === undefined ? undefined : { traceId: message.traceId }
      );

      logger.info("thread.save.completed", {
        requestId,
        context: {
          type: message.type,
          requestedCount: message.posts.length,
          saved: result.saved,
          skipped: result.skipped,
          failed: result.failed,
          threadRootId: result.threadRootId,
          traceId: message.traceId ?? null
        }
      });

      const response: SaveThreadResponse = {
        type: "posts/save-thread-result",
        saved: result.saved,
        skipped: result.skipped,
        failed: result.failed,
        threadRootId: result.threadRootId
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
        nextCursor: result.nextCursor,
        hasMore: result.hasMore
      };
      return response;
    }

    case "posts/thread/get": {
      const thread = await hydrateThreadTree(message.rootId);
      logger.debug("posts.thread_get.completed", {
        requestId,
        context: {
          type: message.type,
          rootId: message.rootId,
          found: thread !== null
        }
      });
      const response: GetThreadResponse = {
        type: "posts/thread/get-result",
        thread
      };
      return response;
    }

    case "thread-expand/status": {
      const response: GetThreadExpandQueueStatusResponse = {
        type: "thread-expand/status",
        record: await getThreadExpandQueueSummary(message.threadRootId)
      };
      return response;
    }

    case "thread-expand/retry": {
      const record = await retryThreadExpandQueue(message.threadRootId);

      if (record !== null) {
        void resumeThreadExpandProcessing();
      }

      const response: RetryThreadExpandResponse = {
        type: "thread-expand/retry",
        record
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

    case "users/summaries": {
      const users = await listArchiveUserSummaries();
      logger.debug("users.summaries.completed", {
        requestId,
        context: {
          type: message.type,
          count: users.length
        }
      });
      const response: UserSummariesResponse = {
        type: "users/summaries-result",
        users
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

    case "post_tag.add": {
      const result = await addPostTagByName(message.postId, message.displayName);
      logger.info("post_tag.add.completed", {
        requestId,
        context: {
          type: message.type,
          postId: message.postId,
          displayName: message.displayName,
          ok: result.ok
        }
      });
      const response: AddPostTagByNameResponse = result.ok
        ? {
            type: "post_tag.add",
            ok: true,
            postTag: result.postTag
          }
        : {
            type: "post_tag.add",
            ok: false,
            error: result.error
          };
      return response;
    }

    case "post_tag.remove": {
      const result = await removePostTagByName(message.postId, message.normalizedName);
      logger.info("post_tag.remove.completed", {
        requestId,
        context: {
          type: message.type,
          postId: message.postId,
          normalizedName: message.normalizedName,
          ok: result.ok
        }
      });
      const response: RemovePostTagByNameResponse = result.ok
        ? {
            type: "post_tag.remove",
            ok: true
          }
        : {
            type: "post_tag.remove",
            ok: false,
            error: result.error
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

    case "tag.bulk-assign.preview": {
      const result = await bulkAssignTagPreview(message.filter, message.targetTagName);
      const response: BulkAssignTagPreviewResponse = {
        type: "tag.bulk-assign.preview",
        ...result
      };
      return response;
    }

    case "tag.bulk-assign.apply-batch": {
      const result = await bulkAssignTagApplyBatch(
        message.postIds,
        message.targetTagId,
        message.targetNormalizedName,
        message.targetDisplayName
      );
      const response: BulkAssignTagApplyBatchResponse = {
        type: "tag.bulk-assign.apply-batch",
        tagged: result.tagged
      };
      return response;
    }

    case "refetch.enqueue": {
      logger.info("refetch.enqueue.requested", {
        requestId,
        context: {
          priority: message.priority,
          enqueueAll: message.enqueueAll ?? false,
          enqueueZeroEngagement: message.enqueueZeroEngagement ?? false,
          explicitPostCount: message.xPostIds?.length ?? 0
        }
      });
      const result = await enqueueRefetchPosts({
        priority: message.priority,
        ...(message.xPostIds === undefined ? {} : { xPostIds: message.xPostIds }),
        ...(message.enqueueAll === undefined ? {} : { enqueueAll: message.enqueueAll }),
        ...(message.enqueueZeroEngagement === undefined
          ? {}
          : { enqueueZeroEngagement: message.enqueueZeroEngagement })
      });
      const response: RefetchEnqueueResponse = {
        type: "refetch.enqueue",
        enqueuedCount: result.enqueuedCount,
        status: result.status
      };
      return response;
    }

    case "refetch.status": {
      const response: RefetchStatusResponse = {
        type: "refetch.status",
        status: await getRefetchStatus()
      };
      return response;
    }

    case "refetch.cancel": {
      const response: RefetchCancelResponse = {
        type: "refetch.cancel",
        status: await cancelRefetch()
      };
      return response;
    }

    case "refetch.clear": {
      const response: RefetchClearResponse = {
        type: "refetch.clear",
        cleared: true,
        status: await clearRefetchQueue()
      };
      return response;
    }

    case "refetch.complete": {
      const response: RefetchCompleteResponse = {
        type: "refetch.complete",
        accepted: completeRefetchFromContentScript(
          {
            xPostId: message.xPostId,
            post: message.post,
            error: message.error ?? null
          },
          sender?.tab?.id ?? null
        )
      };
      return response;
    }

    case "archive/reset": {
      logger.info("archive.reset.started", { requestId });
      await resetExtensionState();
      logger.info("archive.reset.completed", { requestId });
      const response: ResetArchiveResponse = {
        type: "archive/reset-result"
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

    case "tweet-detail-template/set": {
      const template = await setTweetDetailTemplate(message.template);

      logger.info("tweet_detail_template.set.completed", {
        requestId,
        context: {
          type: message.type,
          method: template.method,
          capturedAt: template.captured_at,
          hasAuthorization: Object.prototype.hasOwnProperty.call(
            template.headers,
            "authorization"
          )
        }
      });

      const response: SetTweetDetailTemplateResponse = {
        type: "tweet-detail-template/set-result",
        ok: true,
        capturedAt: template.captured_at
      };
      return response;
    }

    case "tweet-detail/fetch": {
      const result = await fetchTweetDetail(message.focalTweetId, {
        getTemplate: getTweetDetailTemplate
      });

      logger.info("tweet_detail.fetch.completed", {
        requestId,
        context: {
          type: message.type,
          focalTweetId: message.focalTweetId,
          ok: result.ok,
          tweetCount: result.ok ? result.tweetCount : null,
          chainPostCount: result.ok ? result.posts.length : null,
          error: result.ok ? null : result.error,
          status: result.ok ? null : result.status ?? null
        }
      });

      const response: FetchTweetDetailResponse = result.ok
        ? {
            type: "tweet-detail/fetch-result",
            ok: true,
            focalTweetId: result.focalTweetId,
            posts: result.posts,
            tweetCount: result.tweetCount
          }
        : {
            type: "tweet-detail/fetch-result",
            ok: false,
            error: result.error,
            ...(result.status === undefined ? {} : { status: result.status }),
            ...(result.message === undefined ? {} : { message: result.message })
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
    candidate.type === "posts/save-thread" ||
    candidate.type === "posts/has" ||
    candidate.type === "posts/list-page" ||
    candidate.type === "posts/thread/get" ||
    candidate.type === "thread-expand/status" ||
    candidate.type === "thread-expand/retry" ||
    candidate.type === "posts/tags/list" ||
    candidate.type === "users/summaries" ||
    candidate.type === "posts/summary" ||
    candidate.type === "posts/delete" ||
    candidate.type === "post_tag.add" ||
    candidate.type === "post_tag.remove" ||
    candidate.type === "tag.rename" ||
    candidate.type === "tag.merge" ||
    candidate.type === "tag.redirects.list" ||
    candidate.type === "tag.redirects.delete" ||
    candidate.type === "tag.bulk-assign.preview" ||
    candidate.type === "tag.bulk-assign.apply-batch" ||
    candidate.type === "refetch.enqueue" ||
    candidate.type === "refetch.status" ||
    candidate.type === "refetch.cancel" ||
    candidate.type === "refetch.clear" ||
    candidate.type === "refetch.complete" ||
    candidate.type === "archive/reset" ||
    candidate.type === "logs/clear" ||
    candidate.type === "debug/log" ||
    candidate.type === "tweet-detail-template/set" ||
    candidate.type === "tweet-detail/fetch"
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
