import { describe, expect, it } from "vitest";
import { isBookmarksTimelinePage } from "./bookmarks-import-controls";
import { isLikesTimelinePage } from "./likes-import-controls";

// The bulk-import overlays are gated purely on the page URL, and X moved both timelines into
// the History hub (#130). These cases pin the routes down so a future X rename shows up as a
// failing test rather than an overlay that silently stops appearing.
const BOOKMARKS_URLS = [
  "https://x.com/i/history",
  "https://x.com/i/history/",
  "https://x.com/i/bookmarks",
  "https://x.com/i/bookmarks/",
  "https://twitter.com/i/history"
];

const LIKES_URLS = [
  "https://x.com/i/history/likes",
  "https://x.com/i/history/likes/",
  "https://x.com/anifumi/likes",
  "https://x.com/anifumi/likes/",
  "https://twitter.com/i/history/likes"
];

const NON_TIMELINE_URLS = [
  "https://x.com/home",
  "https://x.com/anifumi",
  "https://x.com/anifumi/status/1830000000000000000",
  "https://x.com/i/history/videos",
  "https://x.com/i/history/articles",
  "https://x.com/i/bookmarks/1234567890",
  "not a url"
];

describe("isBookmarksTimelinePage", () => {
  it("matches the History hub bookmarks tab and the legacy bookmarks route", () => {
    for (const url of BOOKMARKS_URLS) {
      expect(isBookmarksTimelinePage(url), url).toBe(true);
    }
  });

  it("rejects pages that are not the bookmarks timeline", () => {
    for (const url of [...LIKES_URLS, ...NON_TIMELINE_URLS]) {
      expect(isBookmarksTimelinePage(url), url).toBe(false);
    }
  });

  it("ignores query strings and fragments", () => {
    expect(isBookmarksTimelinePage("https://x.com/i/history?foo=bar")).toBe(true);
    expect(isBookmarksTimelinePage("https://x.com/i/history#top")).toBe(true);
  });
});

describe("isLikesTimelinePage", () => {
  it("matches the History hub likes tab and the legacy profile likes route", () => {
    for (const url of LIKES_URLS) {
      expect(isLikesTimelinePage(url), url).toBe(true);
    }
  });

  it("rejects pages that are not the likes timeline", () => {
    for (const url of [...BOOKMARKS_URLS, ...NON_TIMELINE_URLS]) {
      expect(isLikesTimelinePage(url), url).toBe(false);
    }
  });

  it("ignores query strings and fragments", () => {
    expect(isLikesTimelinePage("https://x.com/i/history/likes?foo=bar")).toBe(true);
    expect(isLikesTimelinePage("https://x.com/i/history/likes#top")).toBe(true);
  });
});

describe("bookmarks and likes timeline detection", () => {
  // Both overlays are synced in the same pass, so an overlapping match would render two
  // import buttons on one page.
  it("never both match the same url", () => {
    for (const url of [...BOOKMARKS_URLS, ...LIKES_URLS, ...NON_TIMELINE_URLS]) {
      expect(isBookmarksTimelinePage(url) && isLikesTimelinePage(url), url).toBe(false);
    }
  });
});
