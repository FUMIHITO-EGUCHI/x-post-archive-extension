import { createTimelineImportControls } from "./timeline-import-controls";

const controls = createTimelineImportControls({
  rootId: "xpa-likes-import-root",
  overlayId: "xpa-likes-import-overlay",
  toggleButtonId: "xpa-likes-import-toggle",
  actionButtonId: "xpa-likes-import-action",
  traceEventPrefix: "likes.import",
  isTimelinePage(currentUrl: string): boolean {
    try {
      const url = new URL(currentUrl);
      return /^\/[^/]+\/likes\/?$/.test(url.pathname);
    } catch {
      return false;
    }
  },
  autoTagOptions: {
    includeLikedTag: true
  },
  label: {
    englishPageName: "Likes",
    englishImportNoun: "Likes",
    englishArticleNoun: "like",
    japanesePageName: "\u3044\u3044\u306d",
    japaneseImportNoun: "\u3044\u3044\u306d"
  }
});

export function isLikesTimelinePage(currentUrl = window.location.href): boolean {
  return controls.isTimelinePage(currentUrl);
}

export function ensureLikesImportControls(): void {
  controls.ensureImportControls();
}

export function removeLikesImportControls(): void {
  controls.removeImportControls();
}
