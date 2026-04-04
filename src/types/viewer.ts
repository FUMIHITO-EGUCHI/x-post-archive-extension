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

export type ArchiveTagRedirectSummaryRecord = {
  tag_redirect_id: string;
  source_normalized_name: string;
  source_display_name: string;
  target_tag_id: string;
  target_normalized_name: string | null;
  target_display_name: string | null;
  created_at: number;
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

export type FontSizeOption = "small" | "medium" | "large";

export type StorageEstimateState = {
  usage: number | null;
  quota: number | null;
  available: number | null;
  status: "idle" | "ready" | "unsupported";
};

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
