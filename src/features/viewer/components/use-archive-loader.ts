import { useRef, useState } from "react";
import type { ArchivePostRecord, ArchiveTagRecord } from "../../../types/archive";
import type {
  DateFilterTarget,
  ListPostsPageInput,
  PostPageCursor,
  PostSortField,
  SortDirection
} from "../../../types/viewer";
import { createLogger } from "../../logging/logger";
import { requestPostsPage } from "../../runtime/client";

type ViewerStatus = "idle" | "loading" | "ready";

export type LoadArchivePageInput = {
  offset: number;
  limit: number;
  sortField: PostSortField;
  sortDirection: SortDirection;
  randomSeed: number | null;
  tagFilter: string | null;
  authorFilter: string | null;
  dateFilterTarget: DateFilterTarget | null;
  dateFrom: string | null;
  dateTo: string | null;
  append: boolean;
};

const logger = createLogger("archive-loader");

export function useArchiveLoader() {
  const [posts, setPosts] = useState<ArchivePostRecord[]>([]);
  const [archiveTotalCount, setArchiveTotalCount] = useState(0);
  const [hasMorePosts, setHasMorePosts] = useState(false);
  const [status, setStatus] = useState<ViewerStatus>("idle");
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadNotice, setLoadNotice] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<PostPageCursor | null>(null);
  const loadArchiveRequestIdRef = useRef(0);

  async function loadArchivePage(input: LoadArchivePageInput): Promise<void> {
    const requestId = (loadArchiveRequestIdRef.current += 1);

    if (input.append) {
      setIsLoadingMore(true);
    } else {
      setStatus("loading");
    }

    setLoadNotice(null);

    try {
      const response = await requestPostsPage({
        offset: input.offset,
        limit: input.limit,
        sortField: input.sortField,
        sortDirection: input.sortDirection,
        cursor: input.append ? nextCursor : null,
        randomSeed: input.randomSeed,
        tagFilter: input.tagFilter,
        authorFilter: input.authorFilter,
        ...buildDateFilterRequest(input.dateFilterTarget, input.dateFrom, input.dateTo)
      });

      if (requestId !== loadArchiveRequestIdRef.current) {
        return;
      }

      if (input.append) {
        setPosts((current) => [...current, ...response.posts]);
      } else {
        setPosts(response.posts);
      }

      setArchiveTotalCount(response.totalCount);
      setHasMorePosts(response.hasMore);
      setNextCursor(response.nextCursor);
      setStatus("ready");
    } catch (error) {
      if (requestId !== loadArchiveRequestIdRef.current) {
        return;
      }

      logger.error(input.append ? "posts.load_more.failed" : "posts.load.failed", {
        message: input.append ? "Failed to load more posts." : "Failed to load posts.",
        context: {
          error,
          offset: input.offset,
          limit: input.limit,
          append: input.append
        }
      });

      if (!input.append) {
        setPosts([]);
        setArchiveTotalCount(0);
        setHasMorePosts(false);
        setNextCursor(null);
      }

      setStatus("ready");
      setLoadNotice(
        input.append
          ? "More posts could not be loaded."
          : "Posts could not be loaded. Showing an empty list."
      );
    } finally {
      if (input.append) {
        setIsLoadingMore(false);
      }
    }
  }

  function setInitialLoadError() {
    setPosts([]);
    setStatus("ready");
    setLoadNotice("Posts could not be loaded. Showing an empty list.");
  }

  function updatePostTags(
    xPostId: string,
    updateTags: (tags: ArchiveTagRecord[]) => ArchiveTagRecord[]
  ) {
    setPosts((currentPosts) =>
      currentPosts.map((post) =>
        post.x_post_id === xPostId
          ? {
              ...post,
              tags: updateTags(post.tags)
            }
          : post
      )
    );
  }

  function removePostFromCurrentPage(xPostId: string) {
    setPosts((currentPosts) => currentPosts.filter((post) => post.x_post_id !== xPostId));
    setArchiveTotalCount((currentTotalCount) => Math.max(0, currentTotalCount - 1));
  }

  return {
    posts,
    archiveTotalCount,
    hasMorePosts,
    status,
    isLoadingMore,
    loadNotice,
    loadArchivePage,
    setLoadNotice,
    setInitialLoadError,
    updatePostTags,
    removePostFromCurrentPage
  };
}

function normalizeDateInputValue(value: string): string | null {
  const trimmedValue = value.trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmedValue)) {
    return null;
  }

  return trimmedValue;
}

function parseLocalDateInput(value: string): Date | null {
  const normalizedValue = normalizeDateInputValue(value);

  if (normalizedValue === null) {
    return null;
  }

  const [yearText, monthText, dayText] = normalizedValue.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }

  const date = new Date(year, month - 1, day, 0, 0, 0, 0);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function toDateFilterStartTimestamp(value: string | null): number | null {
  if (value === null) {
    return null;
  }

  return parseLocalDateInput(value)?.getTime() ?? null;
}

function toDateFilterEndTimestamp(value: string | null): number | null {
  if (value === null) {
    return null;
  }

  const date = parseLocalDateInput(value);

  if (date === null) {
    return null;
  }

  date.setHours(23, 59, 59, 999);
  return date.getTime();
}

function buildDateFilterRequest(
  dateFilterTarget: DateFilterTarget | null,
  dateFrom: string | null,
  dateTo: string | null
): Pick<ListPostsPageInput, "dateFilterTarget" | "dateFrom" | "dateTo"> {
  const normalizedDateFrom = normalizeDateInputValue(dateFrom ?? "");
  const normalizedDateTo = normalizeDateInputValue(dateTo ?? "");
  const requestDateFrom = toDateFilterStartTimestamp(normalizedDateFrom);
  const requestDateTo = toDateFilterEndTimestamp(normalizedDateTo);
  const hasDateRange = requestDateFrom !== null || requestDateTo !== null;

  return {
    dateFilterTarget: hasDateRange ? dateFilterTarget ?? "saved_at" : null,
    dateFrom: requestDateFrom,
    dateTo: requestDateTo
  };
}
