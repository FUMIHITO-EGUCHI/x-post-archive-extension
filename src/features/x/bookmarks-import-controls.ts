import { createTimelineImportControls } from "./timeline-import-controls";

const controls = createTimelineImportControls({
  rootId: "xpa-bookmarks-import-root",
  overlayId: "xpa-bookmarks-import-overlay",
  toggleButtonId: "xpa-bookmarks-import-toggle",
  actionButtonId: "xpa-bookmarks-import-action",
  traceEventPrefix: "bookmarks.import",
  isTimelinePage(currentUrl: string): boolean {
    try {
      const url = new URL(currentUrl);
      return /^\/i\/bookmarks\/?$/.test(url.pathname);
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
