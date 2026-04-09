import type { SavePostInput } from "../../types/archive";
import type {
  AddPostTagByNameMessage,
  AddPostTagByNameResponse,
  ClearLogsResponse,
  DeleteTagRedirectResponse,
  DeletePostResponse,
  DebugLogMessage,
  GetArchiveSummaryResponse,
  HasPostResponse,
  ListTagRedirectsResponse,
  ListPostTagSummariesResponse,
  ListPostsPageResponse,
  ListPostsResponse,
  UserSummariesResponse,
  MergeTagsMessage,
  MergeTagsResponse,
  RenameTagMessage,
  RenameTagResponse,
  RefetchCancelResponse,
  RefetchClearResponse,
  RefetchEnqueueResponse,
  RefetchStatusResponse,
  RemovePostTagByNameMessage,
  RemovePostTagByNameResponse,
  RuntimeMessage,
  RuntimeResponse,
  SavePostResponse,
  SavePostsBatchResponse
} from "../../types/runtime";
import type { RefetchQueuePriority } from "../../types/refetch";
import type { ListPostsPageInput } from "../../types/viewer";

const DEFAULT_RUNTIME_TIMEOUT_MS = 30000;
const SAVE_RUNTIME_TIMEOUT_MS = 180000;
const SAVE_BATCH_RUNTIME_TIMEOUT_MS = 300000;

export async function requestSavePost(
  post: SavePostInput,
  options: {
    traceId?: string;
  } = {}
): Promise<SavePostResponse> {
  const autoTags = [...(post.auto_tags ?? [])];
  const response = await sendMessage({
    type: "posts/save",
    post: {
      ...post,
      auto_tags: []
    },
    ...(options.traceId === undefined ? {} : { traceId: options.traceId })
  }, SAVE_RUNTIME_TIMEOUT_MS);

  if (response.type !== "posts/save-result") {
    throw new Error("Unexpected runtime response for save request.");
  }

  if (autoTags.length > 0) {
    const postId = response.post?.x_post_id ?? post.x_post_id;

    for (const tagName of autoTags) {
      await requestAddPostTagByName(postId, tagName);
    }
  }

  return response;
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

export async function requestPosts(): Promise<ListPostsResponse> {
  const response = await sendMessage({
    type: "posts/list"
  }, DEFAULT_RUNTIME_TIMEOUT_MS);

  if (response.type !== "posts/list-result") {
    throw new Error("Unexpected runtime response for list request.");
  }

  return response;
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

async function sendMessage(
  message: RuntimeMessage,
  timeoutMs: number
): Promise<RuntimeResponse> {
  const response = (await Promise.race([
    chrome.runtime.sendMessage(message),
    createTimeoutPromise(timeoutMs)
  ])) as RuntimeResponse;

  if (response?.type === "runtime/error") {
    throw new Error(response.message);
  }

  return response;
}

function createTimeoutPromise(timeoutMs: number): Promise<RuntimeResponse> {
  return new Promise((_, reject) => {
    window.setTimeout(() => {
      reject(new Error(`Runtime request timed out after ${timeoutMs}ms.`));
    }, timeoutMs);
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
