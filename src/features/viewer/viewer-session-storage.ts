import type {
  DateFilterTarget,
  PostSortField,
  SortDirection,
  ThreadFilterMode,
  ViewerSessionRestoreMode,
  ViewerSessionState
} from "../../types/viewer";

const VIEWER_SESSION_STORAGE_KEY = "viewer.sessionState";
const VIEWER_SESSION_RESTORE_MODE_STORAGE_KEY = "viewer.sessionRestoreMode";

export async function loadViewerSessionRestoreMode(): Promise<ViewerSessionRestoreMode> {
  const stored = await browser.storage.local.get(VIEWER_SESSION_RESTORE_MODE_STORAGE_KEY);
  const candidate = stored[VIEWER_SESSION_RESTORE_MODE_STORAGE_KEY];

  return isViewerSessionRestoreMode(candidate) ? candidate : "filters";
}

export async function persistViewerSessionRestoreMode(
  mode: ViewerSessionRestoreMode
): Promise<void> {
  await browser.storage.local.set({
    [VIEWER_SESSION_RESTORE_MODE_STORAGE_KEY]: mode
  });
}

export async function loadViewerSession(): Promise<ViewerSessionState | null> {
  const stored = await browser.storage.local.get(VIEWER_SESSION_STORAGE_KEY);
  const candidate = stored[VIEWER_SESSION_STORAGE_KEY];

  return isViewerSessionState(candidate) ? candidate : null;
}

export async function persistViewerSession(state: ViewerSessionState): Promise<void> {
  await browser.storage.local.set({
    [VIEWER_SESSION_STORAGE_KEY]: state
  });
}

export async function clearViewerSession(): Promise<void> {
  await browser.storage.local.remove(VIEWER_SESSION_STORAGE_KEY);
}

function isViewerSessionRestoreMode(value: unknown): value is ViewerSessionRestoreMode {
  return value === "off" || value === "filters" || value === "filters-and-position";
}

function isViewerSessionState(value: unknown): value is ViewerSessionState {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<ViewerSessionState>;

  return (
    candidate.version === 1 &&
    isPostSortField(candidate.sortField) &&
    isSortDirection(candidate.sortDirection) &&
    (candidate.activeTagFilter === null || typeof candidate.activeTagFilter === "string") &&
    (candidate.activeExcludeTagFilter === undefined ||
      candidate.activeExcludeTagFilter === null ||
      typeof candidate.activeExcludeTagFilter === "string") &&
    (candidate.activeAuthorFilter === undefined ||
      candidate.activeAuthorFilter === null ||
      typeof candidate.activeAuthorFilter === "string") &&
    (candidate.activeDateFilterTarget === undefined ||
      candidate.activeDateFilterTarget === null ||
      isDateFilterTarget(candidate.activeDateFilterTarget)) &&
    (candidate.activeDateFrom === undefined ||
      candidate.activeDateFrom === null ||
      typeof candidate.activeDateFrom === "string") &&
    (candidate.activeDateTo === undefined ||
      candidate.activeDateTo === null ||
      typeof candidate.activeDateTo === "string") &&
    (candidate.activeThreadFilter === undefined ||
      isThreadFilterMode(candidate.activeThreadFilter)) &&
    typeof candidate.loadedCount === "number" &&
    Number.isFinite(candidate.loadedCount) &&
    candidate.loadedCount >= 0 &&
    (candidate.anchorPostId === null || typeof candidate.anchorPostId === "string") &&
    typeof candidate.scrollTop === "number" &&
    Number.isFinite(candidate.scrollTop) &&
    candidate.scrollTop >= 0 &&
    typeof candidate.savedAt === "number" &&
    Number.isFinite(candidate.savedAt) &&
    candidate.savedAt > 0
  );
}

function isPostSortField(value: unknown): value is PostSortField {
  return (
    value === "random" ||
    value === "posted_at" ||
    value === "saved_at" ||
    value === "reply_count" ||
    value === "repost_count" ||
    value === "like_count"
  );
}

function isSortDirection(value: unknown): value is SortDirection {
  return value === "asc" || value === "desc";
}

function isDateFilterTarget(value: unknown): value is DateFilterTarget {
  return value === "saved_at" || value === "posted_at";
}

function isThreadFilterMode(value: unknown): value is ThreadFilterMode {
  return value === "all" || value === "single" || value === "thread";
}
