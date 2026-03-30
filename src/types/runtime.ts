import type {
  ArchivePostRecord,
  ArchiveTagRecord,
  PostRecord,
  SavePostInput
} from "./archive";

export type SavePostMessage = {
  type: "posts/save";
  post: SavePostInput;
};

export type HasPostMessage = {
  type: "posts/has";
  xPostId: string;
};

export type ListPostsMessage = {
  type: "posts/list";
};

export type DeletePostMessage = {
  type: "posts/delete";
  xPostId: string;
};

export type AddPostTagMessage = {
  type: "posts/tags/add";
  xPostId: string;
  tagName: string;
};

export type RemovePostTagMessage = {
  type: "posts/tags/remove";
  xPostId: string;
  normalizedTagName: string;
};

export type RuntimeMessage =
  | SavePostMessage
  | HasPostMessage
  | ListPostsMessage
  | DeletePostMessage
  | AddPostTagMessage
  | RemovePostTagMessage;

export type SavePostResponse = {
  type: "posts/save-result";
  status: "saved" | "duplicate";
  post?: PostRecord;
};

export type HasPostResponse = {
  type: "posts/has-result";
  exists: boolean;
};

export type ListPostsResponse = {
  type: "posts/list-result";
  posts: ArchivePostRecord[];
};

export type DeletePostResponse = {
  type: "posts/delete-result";
  deleted: boolean;
};

export type UpdatePostTagsResponse = {
  type: "posts/tags/update-result";
  xPostId: string;
  tags: ArchiveTagRecord[];
};

export type RuntimeErrorResponse = {
  type: "runtime/error";
  message: string;
};

export type RuntimeResponse =
  | SavePostResponse
  | HasPostResponse
  | ListPostsResponse
  | DeletePostResponse
  | UpdatePostTagsResponse
  | RuntimeErrorResponse;
