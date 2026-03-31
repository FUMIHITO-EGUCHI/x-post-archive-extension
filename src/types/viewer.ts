import type { ArchiveTagRecord } from "./archive";

export type PostSortField =
  | "posted_at"
  | "saved_at"
  | "reply_count"
  | "repost_count"
  | "like_count";

export type SortDirection = "desc" | "asc";

export type ArchiveTagSummaryRecord = {
  tag: ArchiveTagRecord;
  postCount: number;
};

export type ArchiveSummaryRecord = {
  postCount: number;
  imageCount: number;
  videoCount: number;
  mediaCount: number;
  accountCount: number;
  tagCount: number;
  mediaBytes: number;
};

export type ListPostsPageInput = {
  offset: number;
  limit: number;
  sortField: PostSortField;
  sortDirection: SortDirection;
  tagFilter: string | null;
};

export type ViewerSessionRestoreMode = "off" | "filters" | "filters-and-position";

export type ViewerSessionState = {
  version: 1;
  sortField: PostSortField;
  sortDirection: SortDirection;
  activeTagFilter: string | null;
  loadedCount: number;
  anchorPostId: string | null;
  scrollTop: number;
  savedAt: number;
};
