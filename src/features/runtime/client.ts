import type { SavePostInput } from "../../types/archive";
import type {
  AddPostTagMessage,
  ClearLogsResponse,
  DeletePostResponse,
  DebugLogMessage,
  GetArchiveSummaryResponse,
  HasPostResponse,
  ListPostTagSummariesResponse,
  ListPostsPageResponse,
  ListPostsResponse,
  RemovePostTagMessage,
  RuntimeMessage,
  RuntimeResponse,
  SavePostResponse,
  SavePostsBatchResponse,
  UpdatePostTagsResponse
} from "../../types/runtime";
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

export async function requestAddPostTag(
  xPostId: string,
  tagName: string
): Promise<UpdatePostTagsResponse> {
  const response = await sendMessage({
    type: "posts/tags/add",
    xPostId,
    tagName
  } satisfies AddPostTagMessage, DEFAULT_RUNTIME_TIMEOUT_MS);

  if (response.type !== "posts/tags/update-result") {
    throw new Error("Unexpected runtime response for add tag request.");
  }

  return response;
}

export async function requestRemovePostTag(
  xPostId: string,
  normalizedTagName: string
): Promise<UpdatePostTagsResponse> {
  const response = await sendMessage({
    type: "posts/tags/remove",
    xPostId,
    normalizedTagName
  } satisfies RemovePostTagMessage, DEFAULT_RUNTIME_TIMEOUT_MS);

  if (response.type !== "posts/tags/update-result") {
    throw new Error("Unexpected runtime response for remove tag request.");
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
