export type SaveSource = "like" | "bookmark" | "manual";

export type StoredPost = {
  id: string;
  authorId: string;
  authorHandle: string;
  authorDisplayName: string;
  content: string;
  permalink: string;
  createdAt: string;
  savedAt: string;
  inReplyToPostId?: string;
  threadId?: string;
  saveSource: SaveSource;
};

export type StoredThread = {
  id: string;
  rootPostId: string;
  authorId: string;
  authorHandle: string;
  postIds: string[];
  savedAt: string;
};

export type TagKind = "auto" | "manual";

export type StoredTag = {
  id: string;
  label: string;
  slug: string;
  kind: TagKind;
  createdAt: string;
};

export type StoredPostTag = {
  id: string;
  postId: string;
  tagId: string;
  kind: TagKind;
  createdAt: string;
};

export type MediaType = "image" | "video" | "gif";

export type StoredMediaRef = {
  id: string;
  postId: string;
  mediaType: MediaType;
  sourceUrl: string;
  previewUrl?: string;
  altText?: string;
  position: number;
};

export type StoredPostMetric = {
  postId: string;
  replyCount: number;
  repostCount: number;
  likeCount: number;
  quoteCount: number;
  capturedAt: string;
};

