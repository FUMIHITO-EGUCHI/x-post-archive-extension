import type { SavePostInput } from "../../types/archive";
import type {
  DeletePostResponse,
  HasPostResponse,
  ListPostsResponse,
  RuntimeMessage,
  RuntimeResponse,
  SavePostResponse
} from "../../types/runtime";

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

async function sendMessage(message: RuntimeMessage): Promise<RuntimeResponse> {
  return (await chrome.runtime.sendMessage(message)) as RuntimeResponse;
}
