import type { PostRecord, SavePostInput } from "./archive";

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

export type RuntimeMessage =
  | SavePostMessage
  | HasPostMessage
  | ListPostsMessage
  | DeletePostMessage;

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
  posts: PostRecord[];
};

export type DeletePostResponse = {
  type: "posts/delete-result";
  deleted: boolean;
};

export type RuntimeResponse =
  | SavePostResponse
  | HasPostResponse
  | ListPostsResponse
  | DeletePostResponse;
