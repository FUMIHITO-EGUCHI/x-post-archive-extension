import {
  addManualTagToArchivePost,
  deleteArchivePost,
  hasSavedPost,
  listArchivePosts,
  removeManualTagFromArchivePost,
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
  UpdatePostTagsResponse
} from "../../types/runtime";

export async function handleRuntimeMessage(
  message: unknown
): Promise<RuntimeResponse | undefined> {
  if (!isRuntimeMessage(message)) {
    return undefined;
  }

  switch (message.type) {
    case "posts/save": {
      const result = await saveArchivePost(message.post);
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
        exists: await hasSavedPost(message.xPostId)
      };
      return response;
    }

    case "posts/list": {
      const response: ListPostsResponse = {
        type: "posts/list-result",
        posts: await listArchivePosts()
      };
      return response;
    }

    case "posts/delete": {
      const response: DeletePostResponse = {
        type: "posts/delete-result",
        deleted: await deleteArchivePost(message.xPostId)
      };
      return response;
    }

    case "posts/tags/add": {
      const response: UpdatePostTagsResponse = {
        type: "posts/tags/update-result",
        xPostId: message.xPostId,
        tags: await addManualTagToArchivePost(message.xPostId, message.tagName)
      };
      return response;
    }

    case "posts/tags/remove": {
      const response: UpdatePostTagsResponse = {
        type: "posts/tags/update-result",
        xPostId: message.xPostId,
        tags: await removeManualTagFromArchivePost(
          message.xPostId,
          message.normalizedTagName
        )
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
