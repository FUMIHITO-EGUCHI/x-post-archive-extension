import { createTimelineImportControls } from "./timeline-import-controls";

// Why: X folded bookmarks and likes into the History hub (#130). /i/history is its default
// tab and holds the bookmarks timeline; the likes timeline lives one segment deeper, so the
// anchored match keeps the two overlays mutually exclusive. /i/bookmarks now redirects to
// /i/history but stays matched — a redirect is not instant, and X has not removed the route.
// Bookmark folder views (/i/bookmarks/<folderId>) remain excluded: they are a filtered subset,
// not the full timeline this import walks.
const BOOKMARKS_TIMELINE_PATHNAME = /^\/(?:i\/history|i\/bookmarks)\/?$/;

function isBookmarksTimelinePathname(pathname: string): boolean {
  return BOOKMARKS_TIMELINE_PATHNAME.test(pathname);
}

const controls = createTimelineImportControls({
  rootId: "xpa-bookmarks-import-root",
  overlayId: "xpa-bookmarks-import-overlay",
  toggleButtonId: "xpa-bookmarks-import-toggle",
  actionButtonId: "xpa-bookmarks-import-action",
  traceEventPrefix: "bookmarks.import",
  isTimelinePage(currentUrl: string): boolean {
    try {
      const url = new URL(currentUrl);
      return isBookmarksTimelinePathname(url.pathname);
    } catch {
      return false;
    }
  },
  autoTagOptions: {
    includeBookmarkedTag: true
  },
  label: {
    englishPageName: "Bookmarks",
    englishImportNoun: "Bookmarks",
    englishArticleNoun: "bookmark",
    japanesePageName: "\u30d6\u30c3\u30af\u30de\u30fc\u30af",
    japaneseImportNoun: "\u30d6\u30c3\u30af\u30de\u30fc\u30af"
  }
});

export function isBookmarksTimelinePage(currentUrl = window.location.href): boolean {
  return controls.isTimelinePage(currentUrl);
}

export function ensureBookmarksImportControls(): void {
  controls.ensureImportControls();
}

export function removeBookmarksImportControls(): void {
  controls.removeImportControls();
}
