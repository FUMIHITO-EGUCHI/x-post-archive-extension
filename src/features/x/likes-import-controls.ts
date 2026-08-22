import { createTimelineImportControls } from "./timeline-import-controls";

// Why: the profile likes tab moved into the History hub (#130). /i/history/likes is the new
// home; /<username>/likes now redirects there but stays matched for the same reason the old
// bookmarks route does. The username branch cannot swallow /i/history/likes — it is anchored
// to a single leading segment — so this never collides with the bookmarks overlay.
const LIKES_TIMELINE_PATHNAME = /^\/(?:i\/history\/likes|[^/]+\/likes)\/?$/;

function isLikesTimelinePathname(pathname: string): boolean {
  return LIKES_TIMELINE_PATHNAME.test(pathname);
}

const controls = createTimelineImportControls({
  rootId: "xpa-likes-import-root",
  overlayId: "xpa-likes-import-overlay",
  toggleButtonId: "xpa-likes-import-toggle",
  actionButtonId: "xpa-likes-import-action",
  traceEventPrefix: "likes.import",
  isTimelinePage(currentUrl: string): boolean {
    try {
      const url = new URL(currentUrl);
      return isLikesTimelinePathname(url.pathname);
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
