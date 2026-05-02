import type { SavePostInput } from "../../types/archive";
import type {
  AddPostTagByNameMessage,
  AddPostTagByNameResponse,
  BulkAssignTagApplyBatchResponse,
  BulkAssignTagPreviewResponse,
  ClearLogsResponse,
  DeleteTagRedirectResponse,
  DeletePostResponse,
  DebugLogMessage,
  GetArchiveSummaryResponse,
  GetThreadResponse,
  HasPostResponse,
  ListTagRedirectsResponse,
  ListPostTagSummariesResponse,
  ListPostsPageResponse,
  UserSummariesResponse,
  MergeTagsMessage,
  MergeTagsResponse,
  RenameTagMessage,
  RenameTagResponse,
  RefetchCancelResponse,
  RefetchClearResponse,
  RefetchCompleteResponse,
  RefetchEnqueueResponse,
  RefetchStatusResponse,
  RemovePostTagByNameMessage,
  RemovePostTagByNameResponse,
  RuntimeMessage,
  RuntimeResponse,
  SavePostResponse,
  SavePostsBatchResponse,
  SaveThreadResponse,
  SetTweetDetailTemplateResponse
} from "../../types/runtime";
import type { TweetDetailTemplateRecord } from "../../types/thread";
import type { RefetchQueuePriority } from "../../types/refetch";
import type { ListPostsPageInput, PostFilterInput } from "../../types/viewer";
import { ARCHIVE_DB_NAME } from "../../db/constants";

const DEFAULT_RUNTIME_TIMEOUT_MS = 30000;
const SAVE_RUNTIME_TIMEOUT_MS = 180000;
const SAVE_BATCH_RUNTIME_TIMEOUT_MS = 300000;
const RESET_RUNTIME_TIMEOUT_MS = 60000;

export async function requestSavePost(
  post: SavePostInput,
  options: {
    traceId?: string;
  } = {}
): Promise<SavePostResponse> {
  const response = await sendMessage({
    type: "posts/save",
    post,
    ...(options.traceId === undefined ? {} : { traceId: options.traceId })
  }, SAVE_RUNTIME_TIMEOUT_MS);

  if (response.type !== "posts/save-result") {
    throw new Error("Unexpected runtime response for save request.");
  }

  return response;
}

export async function requestSaveThread(
  posts: SavePostInput[],
  options: {
    traceId?: string;
  } = {}
): Promise<SaveThreadResponse> {
  const response = await sendMessage({
    type: "posts/save-thread",
    posts,
    ...(options.traceId === undefined ? {} : { traceId: options.traceId })
  }, SAVE_BATCH_RUNTIME_TIMEOUT_MS);

  if (response.type !== "posts/save-thread-result") {
    throw new Error("Unexpected runtime response for save thread request.");
  }

  return response;
}

export async function requestSetTweetDetailTemplate(
  template: Omit<TweetDetailTemplateRecord, "id">
): Promise<SetTweetDetailTemplateResponse> {
  const response = await sendMessage({
    type: "tweet-detail-template/set",
    template
  }, DEFAULT_RUNTIME_TIMEOUT_MS);

  if (response.type !== "tweet-detail-template/set-result") {
    throw new Error("Unexpected runtime response for TweetDetail template save request.");
  }

  return response;
}

export async function requestThreadExpandAuthStaleCheck(): Promise<{
  hasAuthStaleItems: boolean;
  count: number;
}> {
  const response = await sendMessage({
    type: "thread-expand/auth-stale-check"
  }, DEFAULT_RUNTIME_TIMEOUT_MS);

  if (response.type !== "thread-expand/auth-stale-check-result") {
    throw new Error("Unexpected runtime response for thread expand auth stale check.");
  }

  return {
    hasAuthStaleItems: response.hasAuthStaleItems,
    count: response.count
  };
}
export async function requestHasPost(xPostId: string): Promise<boolean> {
  const response = await sendMessage({
    type: "posts/has",
    xPostId
  }, DEFAULT_RUNTIME_TIMEOUT_MS);

  if (response.type !== "posts/has-result") {
    throw new Error("Unexpected runtime response for has request.");
  }

  return response.exists;
}

export async function requestPostsPage(
  input: ListPostsPageInput
): Promise<ListPostsPageResponse> {
  const response = await sendMessage({
    type: "posts/list-page",
    input
  }, DEFAULT_RUNTIME_TIMEOUT_MS);

  if (response.type !== "posts/list-page-result") {
    throw new Error("Unexpected runtime response for page list request.");
  }

  return response;
}

export async function requestThread(rootId: string): Promise<GetThreadResponse> {
  const response = await sendMessage({
    type: "posts/thread/get",
    rootId
  }, DEFAULT_RUNTIME_TIMEOUT_MS);

  if (response.type !== "posts/thread/get-result") {
    throw new Error("Unexpected runtime response for thread request.");
  }

  return response;
}

export async function requestTagSummaries(): Promise<ListPostTagSummariesResponse> {
  const response = await sendMessage({
    type: "posts/tags/list"
  }, DEFAULT_RUNTIME_TIMEOUT_MS);

  if (response.type !== "posts/tags/list-result") {
    throw new Error("Unexpected runtime response for tag list request.");
  }

  return response;
}

export async function requestUserSummaries(): Promise<UserSummariesResponse> {
  const response = await sendMessage({
    type: "users/summaries"
  }, DEFAULT_RUNTIME_TIMEOUT_MS);

  if (response.type !== "users/summaries-result") {
    throw new Error("Unexpected runtime response for user list request.");
  }

  return response;
}

export async function requestArchiveSummary(): Promise<GetArchiveSummaryResponse> {
  const response = await sendMessage({
    type: "posts/summary"
  }, DEFAULT_RUNTIME_TIMEOUT_MS);

  if (response.type !== "posts/summary-result") {
    throw new Error("Unexpected runtime response for archive summary request.");
  }

  return response;
}

export async function requestDeletePost(xPostId: string): Promise<DeletePostResponse> {
  const response = await sendMessage({
    type: "posts/delete",
    xPostId
  }, DEFAULT_RUNTIME_TIMEOUT_MS);

  if (response.type !== "posts/delete-result") {
    throw new Error("Unexpected runtime response for delete request.");
  }

  return response;
}

export async function requestAddPostTagByName(
  postId: string,
  displayName: string
): Promise<AddPostTagByNameResponse> {
  const response = await sendMessage({
    type: "post_tag.add",
    postId,
    displayName
  } satisfies AddPostTagByNameMessage, DEFAULT_RUNTIME_TIMEOUT_MS);

  if (response.type !== "post_tag.add") {
    throw new Error("Unexpected runtime response for post tag add request.");
  }

  if (!response.ok) {
    throw new Error(response.error);
  }

  return response;
}

export async function requestRemovePostTagByName(
  postId: string,
  normalizedName: string
): Promise<RemovePostTagByNameResponse> {
  const response = await sendMessage({
    type: "post_tag.remove",
    postId,
    normalizedName
  } satisfies RemovePostTagByNameMessage, DEFAULT_RUNTIME_TIMEOUT_MS);

  if (response.type !== "post_tag.remove") {
    throw new Error("Unexpected runtime response for post tag remove request.");
  }

  if (!response.ok) {
    throw new Error(response.error);
  }

  return response;
}

export async function requestRenameTag(
  tagId: string,
  newDisplayName: string
): Promise<RenameTagResponse> {
  const response = await sendMessage({
    type: "tag.rename",
    tagId,
    newDisplayName
  } satisfies RenameTagMessage, DEFAULT_RUNTIME_TIMEOUT_MS);

  if (response.type !== "tag.rename") {
    throw new Error("Unexpected runtime response for rename tag request.");
  }

  return response;
}

export async function requestMergeTags(
  sourceTagId: string,
  targetTagId: string,
  preserveFutureTagUses: boolean
): Promise<MergeTagsResponse> {
  const response = await sendMessage({
    type: "tag.merge",
    sourceTagId,
    targetTagId,
    preserveFutureTagUses
  } satisfies MergeTagsMessage, DEFAULT_RUNTIME_TIMEOUT_MS);

  if (response.type !== "tag.merge") {
    throw new Error("Unexpected runtime response for merge tags request.");
  }

  return response;
}

export async function requestTagRedirects(): Promise<ListTagRedirectsResponse> {
  const response = await sendMessage({
    type: "tag.redirects.list"
  }, DEFAULT_RUNTIME_TIMEOUT_MS);

  if (response.type !== "tag.redirects.list") {
    throw new Error("Unexpected runtime response for tag redirect list request.");
  }

  return response;
}

export async function requestDeleteTagRedirect(
  tagRedirectId: string
): Promise<DeleteTagRedirectResponse> {
  const response = await sendMessage({
    type: "tag.redirects.delete",
    tagRedirectId
  }, DEFAULT_RUNTIME_TIMEOUT_MS);

  if (response.type !== "tag.redirects.delete") {
    throw new Error("Unexpected runtime response for tag redirect delete request.");
  }

  return response;
}

export async function requestBulkAssignTagPreview(
  filter: PostFilterInput,
  targetTagName: string
): Promise<BulkAssignTagPreviewResponse> {
  const response = await sendMessage(
    {
      type: "tag.bulk-assign.preview",
      filter,
      targetTagName
    },
    DEFAULT_RUNTIME_TIMEOUT_MS
  );

  if (response.type !== "tag.bulk-assign.preview") {
    throw new Error("Unexpected runtime response for bulk assign preview.");
  }

  return response;
}

export async function requestBulkAssignTagApplyBatch(
  postIds: string[],
  targetTagId: string,
  targetNormalizedName: string,
  targetDisplayName: string
): Promise<BulkAssignTagApplyBatchResponse> {
  const response = await sendMessage(
    {
      type: "tag.bulk-assign.apply-batch",
      postIds,
      targetTagId,
      targetNormalizedName,
      targetDisplayName
    },
    DEFAULT_RUNTIME_TIMEOUT_MS
  );

  if (response.type !== "tag.bulk-assign.apply-batch") {
    throw new Error("Unexpected runtime response for bulk assign apply batch.");
  }

  return response;
}

export async function requestRefetchEnqueuePosts(
  xPostIds: string[],
  priority: RefetchQueuePriority
): Promise<RefetchEnqueueResponse> {
  const response = await sendMessage({
    type: "refetch.enqueue",
    xPostIds,
    priority
  }, DEFAULT_RUNTIME_TIMEOUT_MS);

  if (response.type !== "refetch.enqueue") {
    throw new Error("Unexpected runtime response for refetch enqueue request.");
  }

  return response;
}

export async function requestRefetchEnqueueAll(
  priority: RefetchQueuePriority
): Promise<RefetchEnqueueResponse> {
  const response = await sendMessage({
    type: "refetch.enqueue",
    enqueueAll: true,
    priority
  }, DEFAULT_RUNTIME_TIMEOUT_MS);

  if (response.type !== "refetch.enqueue") {
    throw new Error("Unexpected runtime response for refetch enqueue-all request.");
  }

  return response;
}

export async function requestRefetchEnqueueZeroEngagement(
  priority: RefetchQueuePriority
): Promise<RefetchEnqueueResponse> {
  const zeroEngagementPostIds = await listZeroEngagementPostIds();
  return requestRefetchEnqueuePosts(zeroEngagementPostIds, priority);
}

export async function requestRefetchStatus(): Promise<RefetchStatusResponse> {
  const response = await sendMessage({
    type: "refetch.status"
  }, DEFAULT_RUNTIME_TIMEOUT_MS);

  if (response.type !== "refetch.status") {
    throw new Error("Unexpected runtime response for refetch status request.");
  }

  return response;
}

export async function requestRefetchCancel(): Promise<RefetchCancelResponse> {
  const response = await sendMessage({
    type: "refetch.cancel"
  }, DEFAULT_RUNTIME_TIMEOUT_MS);

  if (response.type !== "refetch.cancel") {
    throw new Error("Unexpected runtime response for refetch cancel request.");
  }

  return response;
}

export async function requestRefetchClear(): Promise<RefetchClearResponse> {
  const response = await sendMessage({
    type: "refetch.clear"
  }, DEFAULT_RUNTIME_TIMEOUT_MS);

  if (response.type !== "refetch.clear") {
    throw new Error("Unexpected runtime response for refetch clear request.");
  }

  return response;
}

export async function requestNotifyRefetchComplete(
  xPostId: string,
  post: SavePostInput | null,
  error: string | null
): Promise<RefetchCompleteResponse> {
  const response = await sendMessage({
    type: "refetch.complete",
    xPostId,
    post,
    error
  }, DEFAULT_RUNTIME_TIMEOUT_MS);

  if (response.type !== "refetch.complete") {
    throw new Error("Unexpected runtime response for refetch complete request.");
  }

  return response;
}

export async function requestResetArchive(): Promise<void> {
  const response = await sendMessage({
    type: "archive/reset"
  }, RESET_RUNTIME_TIMEOUT_MS);

  if (response.type !== "archive/reset-result") {
    throw new Error("Unexpected runtime response for archive reset request.");
  }
}

async function sendMessage(
  message: RuntimeMessage,
  timeoutMs: number
): Promise<RuntimeResponse> {
  let timeoutId: number | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => {
      reject(new Error(`Runtime request timed out after ${timeoutMs}ms.`));
    }, timeoutMs);
  });

  const response = (await Promise.race([
    chrome.runtime.sendMessage(message),
    timeoutPromise
  ]).finally(() => {
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
    }
  })) as RuntimeResponse;

  if (response?.type === "runtime/error") {
    throw new Error(response.message);
  }

  return response;
}

async function listZeroEngagementPostIds(): Promise<string[]> {
  return new Promise<string[]>((resolve, reject) => {
    const openRequest = indexedDB.open(ARCHIVE_DB_NAME);

    openRequest.onerror = () => {
      reject(openRequest.error ?? new Error("Failed to open the archive database."));
    };

    openRequest.onsuccess = () => {
      const nativeDb = openRequest.result;
      const transaction = nativeDb.transaction("posts", "readonly");
      const store = transaction.objectStore("posts");
      const index = store.index("reply_count");
      const cursorRequest = index.openCursor(IDBKeyRange.only(0));
      const postIds: string[] = [];

      cursorRequest.onerror = () => {
        nativeDb.close();
        reject(cursorRequest.error ?? new Error("Failed to query zero-engagement posts."));
      };

      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;

        if (cursor === null) {
          return;
        }

        const post = cursor.value as {
          x_post_id: string;
          repost_count: number;
          like_count: number;
        };

        if (post.repost_count === 0 && post.like_count === 0) {
          postIds.push(post.x_post_id);
        }

        cursor.continue();
      };

      transaction.oncomplete = () => {
        nativeDb.close();
        resolve(postIds);
      };

      transaction.onerror = () => {
        nativeDb.close();
        reject(transaction.error ?? new Error("Failed to complete zero-engagement query."));
      };
    };
  });
}

export async function requestSavePostsBatch(
  posts: SavePostInput[],
  options: {
    traceId?: string;
  } = {}
): Promise<SavePostsBatchResponse> {
  const response = await sendMessage({
    type: "posts/save-batch",
    posts,
    ...(options.traceId === undefined ? {} : { traceId: options.traceId })
  }, SAVE_BATCH_RUNTIME_TIMEOUT_MS);

  if (response.type !== "posts/save-batch-result") {
    throw new Error("Unexpected runtime response for batch save request.");
  }

  return response;
}

export async function requestClearLogs(): Promise<ClearLogsResponse> {
  const response = await sendMessage({
    type: "logs/clear"
  }, DEFAULT_RUNTIME_TIMEOUT_MS);

  if (response.type !== "logs/clear-result") {
    throw new Error("Unexpected runtime response for clear logs request.");
  }

  return response;
}

export async function requestDebugLog(
  input: Omit<DebugLogMessage, "type">
): Promise<void> {
  await sendMessage({
    type: "debug/log",
    ...input
  }, DEFAULT_RUNTIME_TIMEOUT_MS);
}
