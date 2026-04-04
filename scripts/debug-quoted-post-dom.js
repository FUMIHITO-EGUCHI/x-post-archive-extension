/*
Quoted Post DOM Investigation Script
Usage:
1. Open X.com in Chrome and navigate to a page with quoted tweets visible.
2. Open DevTools on the page.
3. Paste this file into the console or save it as a DevTools Snippet and run it.
4. Inspect window.__xpaQuotedPostScan for the full result set.

Finds all tweet articles and investigates quoted tweet DOM structure within each.
*/

(() => {
  const root = globalThis;
  const POST_PATH_PATTERN = /^\/([^/]+)\/status\/(\d+)$/;

  const CANDIDATE_SELECTORS = [
    '[data-testid="quotedTweet-link"]',
    '[data-testid="quotedTweet"]',
    '[data-testid="tweet-quoted"]',
    '[data-testid="quoteTweet"]',
    'div[role="link"][tabindex="0"]',
  ];

  const articles = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
  const rows = articles.map((article, index) => inspectArticle(article, index));
  const articlesWithQuotes = rows.filter((row) => row.hasQuote);

  const summary = {
    articleCount: articles.length,
    articlesWithQuote: articlesWithQuotes.length,
    selectorHits: Object.fromEntries(
      CANDIDATE_SELECTORS.map((sel) => [
        sel,
        rows.filter((r) => r.selectorHits[sel]).length,
      ])
    ),
  };

  const report = {
    createdAt: new Date().toISOString(),
    summary,
    rows: articlesWithQuotes,
  };

  root.__xpaQuotedPostScan = report;
  exportJsonReport("xpa-quoted-post-scan", report);

  console.group("XPA Quoted Post DOM Scan");
  console.log("Summary", summary);
  console.log("Articles with quotes (first 10):", articlesWithQuotes.slice(0, 10));
  console.groupEnd();

  function inspectArticle(article, index) {
    const mainPermalink = findFirstPermalink(article, null);
    const selectorHits = {};
    let quotedContainer = null;
    let quotedSelectorUsed = null;

    for (const sel of CANDIDATE_SELECTORS) {
      const el = article.querySelector(sel);
      selectorHits[sel] = el !== null;
      if (el !== null && quotedContainer === null) {
        quotedContainer = el;
        quotedSelectorUsed = sel;
      }
    }

    // Collect testIds found in the article for discovery
    const allTestIds = unique(
      Array.from(article.querySelectorAll("[data-testid]")).map((el) =>
        el.getAttribute("data-testid")
      )
    );

    // Check media inside vs outside quoted container
    const allPhotoAnchors = Array.from(article.querySelectorAll('a[href*="/photo/"]'));
    const quotedPhotoAnchors = quotedContainer
      ? Array.from(quotedContainer.querySelectorAll('a[href*="/photo/"]'))
      : [];
    const mainPhotoAnchors = allPhotoAnchors.filter((a) => !quotedPhotoAnchors.includes(a));

    const allMediaImages = Array.from(
      article.querySelectorAll('img[src*="pbs.twimg.com/media/"]')
    );
    const quotedMediaImages = quotedContainer
      ? Array.from(quotedContainer.querySelectorAll('img[src*="pbs.twimg.com/media/"]'))
      : [];
    const mainMediaImages = allMediaImages.filter((img) => !quotedMediaImages.includes(img));

    // Quoted post permalink
    const quotedPermalink = quotedContainer ? findFirstPermalink(quotedContainer, null) : null;

    // Text elements
    const mainTweetText = article.querySelector('[data-testid="tweetText"]');
    const quotedTweetText = quotedContainer
      ? quotedContainer.querySelector('[data-testid="tweetText"]')
      : null;
    const allTweetTexts = Array.from(article.querySelectorAll('[data-testid="tweetText"]'));

    // User-Name elements
    const allUserNames = Array.from(article.querySelectorAll('[data-testid="User-Name"]'));
    const quotedUserName = quotedContainer
      ? quotedContainer.querySelector('[data-testid="User-Name"]')
      : null;

    return {
      index,
      mainPostId: mainPermalink?.xPostId ?? null,
      hasQuote: quotedContainer !== null,
      quotedSelectorUsed,
      selectorHits,
      allTestIds,
      mainText: (mainTweetText?.textContent ?? "").trim().slice(0, 80),
      quotedText: (quotedTweetText?.textContent ?? "").trim().slice(0, 80),
      tweetTextCount: allTweetTexts.length,
      userNameCount: allUserNames.length,
      quotedUserNameFound: quotedUserName !== null,
      quotedPostId: quotedPermalink?.xPostId ?? null,
      quotedUsername: quotedPermalink?.xUsername ?? null,
      allPhotoAnchorCount: allPhotoAnchors.length,
      mainPhotoAnchorCount: mainPhotoAnchors.length,
      quotedPhotoAnchorCount: quotedPhotoAnchors.length,
      allMediaImageCount: allMediaImages.length,
      mainMediaImageCount: mainMediaImages.length,
      quotedMediaImageCount: quotedMediaImages.length,
      // Structural info about the quoted container
      quotedContainerTag: quotedContainer?.tagName ?? null,
      quotedContainerRole: quotedContainer?.getAttribute("role") ?? null,
      quotedContainerDataTestId: quotedContainer?.getAttribute("data-testid") ?? null,
      quotedContainerHref: quotedContainer?.getAttribute("href") ?? null,
    };
  }

  function findFirstPermalink(root, excludeEl) {
    const anchors = Array.from(root.querySelectorAll('a[href*="/status/"]'));
    for (const anchor of anchors) {
      if (excludeEl && (excludeEl === anchor || excludeEl.contains(anchor))) continue;
      try {
        const url = new URL(anchor.href, window.location.origin);
        const matched = url.pathname.match(POST_PATH_PATTERN);
        if (!matched) continue;
        const xUsername = matched[1];
        const xPostId = matched[2];
        if (!xUsername || !xPostId) continue;
        return { xUsername, xPostId };
      } catch {
        // Ignore.
      }
    }
    return null;
  }

  function unique(values) {
    return [...new Set(values)];
  }

  function exportJsonReport(filenameBase, payload) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `${filenameBase}-${timestamp}.json`;
    const jsonText = JSON.stringify(payload, null, 2);
    root.__xpaLastJsonReport = { filename, jsonText };

    if (typeof document === "undefined" || typeof URL === "undefined") {
      return { filename, downloaded: false, jsonText };
    }
    const blob = new Blob([jsonText], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    return { filename, downloaded: true };
  }
})();
