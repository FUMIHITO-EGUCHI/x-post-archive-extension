import {
  deletePost,
  hasPost,
  listPosts,
  savePost
} from "../../db/repositories/posts-repository";
import type {
  DeletePostResponse,
  HasPostResponse,
  ListPostsResponse,
  RuntimeMessage,
  RuntimeErrorResponse,
  RuntimeResponse,
  SavePostResponse
} from "../../types/runtime";

export async function handleRuntimeMessage(
  message: unknown
): Promise<RuntimeResponse | undefined> {
  if (!isRuntimeMessage(message)) {
    return undefined;
  }

  switch (message.type) {
    case "posts/save": {
      const result = await savePost(message.post);
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

    case "posts/has": {
      const response: HasPostResponse = {
        type: "posts/has-result",
        exists: await hasPost(message.xPostId)
      };
      return response;
    }

    case "posts/list": {
      const response: ListPostsResponse = {
        type: "posts/list-result",
        posts: await listPosts()
      };
      return response;
    }

    case "posts/delete": {
      const response: DeletePostResponse = {
        type: "posts/delete-result",
        deleted: await deletePost(message.xPostId)
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
    candidate.type === "posts/has" ||
    candidate.type === "posts/list" ||
    candidate.type === "posts/delete"
  );
}

export function createRuntimeErrorResponse(error: unknown): RuntimeErrorResponse {
  return {
    type: "runtime/error",
    message: error instanceof Error ? error.message : "Unexpected runtime error."
  };
}
