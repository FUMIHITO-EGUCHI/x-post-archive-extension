import type {
  ArchivePostRecord,
  PostTagRecord,
  PostRecord,
  SavePostInput,
  TagRecord
} from "./archive";
import type { LogLevel } from "./logger";
import type {
  RefetchQueuePriority,
  RefetchStatusRecord
} from "./refetch";
import type { TweetDetailClientError, TweetDetailTemplateRecord } from "./thread";
import type {
  ArchiveSummaryRecord,
  ArchiveTagRedirectSummaryRecord,
  ArchiveTagSummaryRecord,
  ListPostsPageInput,
  PostPageCursor,
  PostFilterInput,
  ThreadedPostRecord,
  UserSummary
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

export type SaveThreadMessage = {
  type: "posts/save-thread";
  posts: SavePostInput[];
  traceId?: string;
};

export type HasPostMessage = {
  type: "posts/has";
  xPostId: string;
};

export type ListPostsPageMessage = {
  type: "posts/list-page";
  input: ListPostsPageInput;
};

export type GetThreadMessage = {
  type: "posts/thread/get";
  rootId: string;
};

export type ListPostTagSummariesMessage = {
  type: "posts/tags/list";
};

export type RequestUserSummariesMessage = {
  type: "users/summaries";
};

export type GetArchiveSummaryMessage = {
  type: "posts/summary";
};

export type DeletePostMessage = {
  type: "posts/delete";
  xPostId: string;
};

export type AddPostTagByNameMessage = {
  type: "post_tag.add";
  postId: string;
  displayName: string;
};

export type RemovePostTagByNameMessage = {
  type: "post_tag.remove";
  postId: string;
  normalizedName: string;
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
  preserveFutureTagUses: boolean;
};

export type ListTagRedirectsMessage = {
  type: "tag.redirects.list";
};

export type DeleteTagRedirectMessage = {
  type: "tag.redirects.delete";
  tagRedirectId: string;
};

export type BulkAssignTagPreviewMessage = {
  type: "tag.bulk-assign.preview";
  filter: PostFilterInput;
  targetTagName: string;
};

export type BulkAssignTagApplyBatchMessage = {
  type: "tag.bulk-assign.apply-batch";
  postIds: string[];
  targetTagId: string;
  targetNormalizedName: string;
  targetDisplayName: string;
};

export type RefetchEnqueueMessage = {
  type: "refetch.enqueue";
  priority: RefetchQueuePriority;
  xPostIds?: string[];
  enqueueAll?: boolean;
  enqueueZeroEngagement?: boolean;
};

export type RefetchStatusMessage = {
  type: "refetch.status";
};

export type RefetchCancelMessage = {
  type: "refetch.cancel";
};

export type RefetchClearMessage = {
  type: "refetch.clear";
};

export type RefetchCompleteMessage = {
  type: "refetch.complete";
  xPostId: string;
  post: SavePostInput | null;
  error?: string | null;
};

export type ResetArchiveMessage = {
  type: "archive/reset";
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

export type SetTweetDetailTemplateMessage = {
  type: "tweet-detail-template/set";
  template: Omit<TweetDetailTemplateRecord, "id">;
};

export type FetchTweetDetailMessage = {
  type: "tweet-detail/fetch";
  focalTweetId: string;
};

export type RuntimeMessage =
  | SavePostMessage
  | SavePostsBatchMessage
  | SaveThreadMessage
  | HasPostMessage
  | ListPostsPageMessage
  | GetThreadMessage
  | ListPostTagSummariesMessage
  | RequestUserSummariesMessage
  | GetArchiveSummaryMessage
  | DeletePostMessage
  | AddPostTagByNameMessage
  | RemovePostTagByNameMessage
  | RenameTagMessage
  | MergeTagsMessage
  | ListTagRedirectsMessage
  | DeleteTagRedirectMessage
  | BulkAssignTagPreviewMessage
  | BulkAssignTagApplyBatchMessage
  | RefetchEnqueueMessage
  | RefetchStatusMessage
  | RefetchCancelMessage
  | RefetchClearMessage
  | RefetchCompleteMessage
  | ResetArchiveMessage
  | ClearLogsMessage
  | DebugLogMessage
  | SetTweetDetailTemplateMessage
  | FetchTweetDetailMessage;

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

export type SaveThreadResponse = {
  type: "posts/save-thread-result";
  saved: number;
  skipped: number;
  failed: number;
  threadRootId: string | null;
};

export type HasPostResponse = {
  type: "posts/has-result";
  exists: boolean;
};

export type ListPostsPageResponse = {
  type: "posts/list-page-result";
  posts: ArchivePostRecord[];
  totalCount: number;
  nextOffset: number;
  nextCursor: PostPageCursor | null;
  hasMore: boolean;
};

export type GetThreadResponse = {
  type: "posts/thread/get-result";
  thread: ThreadedPostRecord | null;
};

export type ListPostTagSummariesResponse = {
  type: "posts/tags/list-result";
  tags: ArchiveTagSummaryRecord[];
};

export type UserSummariesResponse = {
  type: "users/summaries-result";
  users: UserSummary[];
};

export type GetArchiveSummaryResponse = {
  type: "posts/summary-result";
  summary: ArchiveSummaryRecord;
};

export type DeletePostResponse = {
  type: "posts/delete-result";
  deleted: boolean;
};

export type AddPostTagByNameResponse =
  | {
      type: "post_tag.add";
      ok: true;
      postTag: PostTagRecord;
    }
  | {
      type: "post_tag.add";
      ok: false;
      error: string;
    };

export type RemovePostTagByNameResponse =
  | {
      type: "post_tag.remove";
      ok: true;
    }
  | {
      type: "post_tag.remove";
      ok: false;
      error: string;
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

export type ListTagRedirectsResponse = {
  type: "tag.redirects.list";
  redirects: ArchiveTagRedirectSummaryRecord[];
};

export type DeleteTagRedirectResponse = {
  type: "tag.redirects.delete";
  deleted: boolean;
};

export type BulkAssignTagPreviewResponse = {
  type: "tag.bulk-assign.preview";
  candidatePostIds: string[];
  targetTagId: string;
  targetNormalizedName: string;
  targetDisplayName: string;
  totalMatchCount: number;
  skipCount: number;
};

export type BulkAssignTagApplyBatchResponse = {
  type: "tag.bulk-assign.apply-batch";
  tagged: number;
};

export type RefetchEnqueueResponse = {
  type: "refetch.enqueue";
  enqueuedCount: number;
  status: RefetchStatusRecord;
};

export type RefetchStatusResponse = {
  type: "refetch.status";
  status: RefetchStatusRecord;
};

export type RefetchCancelResponse = {
  type: "refetch.cancel";
  status: RefetchStatusRecord;
};

export type RefetchClearResponse = {
  type: "refetch.clear";
  cleared: boolean;
  status: RefetchStatusRecord;
};

export type RefetchCompleteResponse = {
  type: "refetch.complete";
  accepted: boolean;
};

export type ResetArchiveResponse = {
  type: "archive/reset-result";
};

export type ClearLogsResponse = {
  type: "logs/clear-result";
  deleted: boolean;
};

export type RuntimeErrorResponse = {
  type: "runtime/error";
  message: string;
};

export type SetTweetDetailTemplateResponse = {
  type: "tweet-detail-template/set-result";
  ok: true;
  capturedAt: number;
};

export type FetchTweetDetailResponse =
  | {
      type: "tweet-detail/fetch-result";
      ok: true;
      focalTweetId: string;
      posts: SavePostInput[];
      tweetCount: number;
    }
  | {
      type: "tweet-detail/fetch-result";
      ok: false;
      error: TweetDetailClientError;
      status?: number;
      message?: string;
    };

export type RuntimeResponse =
  | SavePostResponse
  | SavePostsBatchResponse
  | SaveThreadResponse
  | HasPostResponse
  | ListPostsPageResponse
  | GetThreadResponse
  | ListPostTagSummariesResponse
  | UserSummariesResponse
  | GetArchiveSummaryResponse
  | DeletePostResponse
  | AddPostTagByNameResponse
  | RemovePostTagByNameResponse
  | RenameTagResponse
  | MergeTagsResponse
  | ListTagRedirectsResponse
  | DeleteTagRedirectResponse
  | BulkAssignTagPreviewResponse
  | BulkAssignTagApplyBatchResponse
  | RefetchEnqueueResponse
  | RefetchStatusResponse
  | RefetchCancelResponse
  | RefetchClearResponse
  | RefetchCompleteResponse
  | ResetArchiveResponse
  | ClearLogsResponse
  | SetTweetDetailTemplateResponse
  | FetchTweetDetailResponse
  | RuntimeErrorResponse;
