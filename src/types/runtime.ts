import type {
  ArchivePostRecord,
  ArchiveTagRecord,
  PostRecord,
  SavePostInput,
  TagRecord
} from "./archive";
import type { LogLevel } from "./logger";
import type {
  ArchiveSummaryRecord,
  ArchiveTagSummaryRecord,
  ListPostsPageInput
} from "./viewer";

export type SavePostMessage = {
  type: "posts/save";
  post: SavePostInput;
  traceId?: string;
};

export type SavePostsBatchMessage = {
  type: "posts/save-batch";
  posts: SavePostInput[];
  traceId?: string;
};

export type HasPostMessage = {
  type: "posts/has";
  xPostId: string;
};

export type ListPostsMessage = {
  type: "posts/list";
};

export type ListPostsPageMessage = {
  type: "posts/list-page";
  input: ListPostsPageInput;
};

export type ListPostTagSummariesMessage = {
  type: "posts/tags/list";
};

export type GetArchiveSummaryMessage = {
  type: "posts/summary";
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

export type RenameTagMessage = {
  type: "tag.rename";
  tagId: string;
  newDisplayName: string;
};

export type MergeTagsMessage = {
  type: "tag.merge";
  sourceTagId: string;
  targetTagId: string;
};

export type ClearLogsMessage = {
  type: "logs/clear";
};

export type DebugLogMessage = {
  type: "debug/log";
  level: LogLevel;
  event: string;
  message?: string;
  context?: Record<string, unknown>;
  traceId?: string;
};

export type RuntimeMessage =
  | SavePostMessage
  | SavePostsBatchMessage
  | HasPostMessage
  | ListPostsMessage
  | ListPostsPageMessage
  | ListPostTagSummariesMessage
  | GetArchiveSummaryMessage
  | DeletePostMessage
  | AddPostTagMessage
  | RemovePostTagMessage
  | RenameTagMessage
  | MergeTagsMessage
  | ClearLogsMessage
  | DebugLogMessage;

export type SavePostResponse = {
  type: "posts/save-result";
  status: "saved" | "duplicate";
  post?: PostRecord;
};

export type SavePostsBatchResponse = {
  type: "posts/save-batch-result";
  saved: number;
  duplicates: number;
  failed: number;
};

export type HasPostResponse = {
  type: "posts/has-result";
  exists: boolean;
};

export type ListPostsResponse = {
  type: "posts/list-result";
  posts: ArchivePostRecord[];
};

export type ListPostsPageResponse = {
  type: "posts/list-page-result";
  posts: ArchivePostRecord[];
  totalCount: number;
  nextOffset: number;
  hasMore: boolean;
};

export type ListPostTagSummariesResponse = {
  type: "posts/tags/list-result";
  tags: ArchiveTagSummaryRecord[];
};

export type GetArchiveSummaryResponse = {
  type: "posts/summary-result";
  summary: ArchiveSummaryRecord;
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

export type RenameTagResponse =
  | {
      type: "tag.rename";
      ok: true;
      tag: TagRecord;
    }
  | {
      type: "tag.rename";
      ok: false;
      error: "collision";
      conflictingTagId: string;
    };

export type MergeTagsResponse = {
  type: "tag.merge";
  mergedPostCount: number;
  removedDuplicateCount: number;
};

export type ClearLogsResponse = {
  type: "logs/clear-result";
  deleted: boolean;
};

export type RuntimeErrorResponse = {
  type: "runtime/error";
  message: string;
};

export type RuntimeResponse =
  | SavePostResponse
  | SavePostsBatchResponse
  | HasPostResponse
  | ListPostsResponse
  | ListPostsPageResponse
  | ListPostTagSummariesResponse
  | GetArchiveSummaryResponse
  | DeletePostResponse
  | UpdatePostTagsResponse
  | RenameTagResponse
  | MergeTagsResponse
  | ClearLogsResponse
  | RuntimeErrorResponse;
