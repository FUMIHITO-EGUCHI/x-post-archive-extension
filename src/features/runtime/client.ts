import type { SavePostInput } from "../../types/archive";
import type {
  AddPostTagMessage,
  DeletePostResponse,
  HasPostResponse,
  ListPostsResponse,
  RemovePostTagMessage,
  RuntimeMessage,
  RuntimeResponse,
  SavePostResponse,
  UpdatePostTagsResponse
} from "../../types/runtime";

const RUNTIME_TIMEOUT_MS = 5000;

export async function requestSavePost(post: SavePostInput): Promise<SavePostResponse> {
  const response = await sendMessage({
    type: "posts/save",
    post
  });

  if (response.type !== "posts/save-result") {
    throw new Error("Unexpected runtime response for save request.");
  }

  return response;
}

export async function requestHasPost(xPostId: string): Promise<boolean> {
  const response = await sendMessage({
    type: "posts/has",
    xPostId
  });

  if (response.type !== "posts/has-result") {
    throw new Error("Unexpected runtime response for has request.");
  }

  return response.exists;
}

export async function requestPosts(): Promise<ListPostsResponse> {
  const response = await sendMessage({
    type: "posts/list"
  });

  if (response.type !== "posts/list-result") {
    throw new Error("Unexpected runtime response for list request.");
  }

  return response;
}

export async function requestDeletePost(xPostId: string): Promise<DeletePostResponse> {
  const response = await sendMessage({
    type: "posts/delete",
    xPostId
  });

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
  } satisfies AddPostTagMessage);

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
  } satisfies RemovePostTagMessage);

  if (response.type !== "posts/tags/update-result") {
    throw new Error("Unexpected runtime response for remove tag request.");
  }

  return response;
}

async function sendMessage(message: RuntimeMessage): Promise<RuntimeResponse> {
  const response = (await Promise.race([
    chrome.runtime.sendMessage(message),
    createTimeoutPromise()
  ])) as RuntimeResponse;

  if (response?.type === "runtime/error") {
    throw new Error(response.message);
  }

  return response;
}

function createTimeoutPromise(): Promise<RuntimeResponse> {
  return new Promise((_, reject) => {
    window.setTimeout(() => {
      reject(new Error(`Runtime request timed out after ${RUNTIME_TIMEOUT_MS}ms.`));
    }, RUNTIME_TIMEOUT_MS);
  });
}
