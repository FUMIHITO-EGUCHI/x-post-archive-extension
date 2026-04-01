/*
Usage:
1. Open an X likes page in Chrome.
2. Open DevTools on the page.
3. Paste this file into the console or save it as a DevTools Snippet and run it.
4. Inspect window.__xpaLikesDomScan for the full result set.
*/

(() => {
  const root = globalThis;
  const POST_PATH_PATTERN = /^\/([^/]+)\/status\/(\d+)$/;

  const articles = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
  const rows = articles.map((article, index) => inspectArticle(article, index)).filter(Boolean);

  const summary = {
    articleCount: articles.length,
    inspectedCount: rows.length,
    withPhotoAnchors: rows.filter((row) => row.photoAnchorCount > 0).length,
    withAnchorImages: rows.filter((row) => row.anchorImageCount > 0).length,
    withDirectMediaImages: rows.filter((row) => row.directMediaImageCount > 0).length,
    withVideoElements: rows.filter((row) => row.videoElementCount > 0).length,
    selectorMismatchCandidates: rows.filter(
      (row) => row.photoAnchorCount === 0 && row.directMediaImageCount > 0
    ).length
  };

  const report = {
    createdAt: new Date().toISOString(),
    summary,
    rows
  };
  root.__xpaLikesDomScan = report;
  const exportResult = exportJsonReport("xpa-likes-dom-scan", report);

  console.group("XPA Likes DOM Scan");
  console.log("Summary", summary);
  console.table(
    rows.slice(0, 30).map((row) => ({
      index: row.index,
      xPostId: row.xPostId,
      textLength: row.textLength,
      photoAnchorCount: row.photoAnchorCount,
      anchorImageCount: row.anchorImageCount,
      directMediaImageCount: row.directMediaImageCount,
      videoElementCount: row.videoElementCount,
      selectorMismatch: row.selectorMismatch,
      permalinkFound: row.permalinkFound
    }))
  );
  console.log("Report saved to globalThis.__xpaLikesDomScan");
  console.log("JSON export", exportResult);
  console.groupEnd();

  function inspectArticle(article, index) {
    const permalink = findPermalink(article);
    const tweetText = article.querySelector('[data-testid="tweetText"]');
    const photoAnchors = Array.from(article.querySelectorAll('a[href*="/photo/"]'));
    const anchorImages = photoAnchors.flatMap((anchor) =>
      Array.from(anchor.querySelectorAll("img[src]"))
    );
    const directMediaImages = Array.from(
      article.querySelectorAll('img[src*="pbs.twimg.com/media/"], img[src*="pbs.twimg.com/ext_tw_video_thumb/"]')
    );
    const videoElements = Array.from(article.querySelectorAll("video"));

    return {
      index,
      xPostId: permalink?.xPostId ?? null,
      xUsername: permalink?.xUsername ?? null,
      permalinkFound: permalink !== null,
      textLength: (tweetText?.innerText ?? tweetText?.textContent ?? "").trim().length,
      photoAnchorCount: photoAnchors.length,
      anchorImageCount: anchorImages.length,
      directMediaImageCount: directMediaImages.length,
      videoElementCount: videoElements.length,
      selectorMismatch: photoAnchors.length === 0 && directMediaImages.length > 0,
      anchorImageUrls: unique(anchorImages.map((image) => image.currentSrc || image.src).filter(Boolean)),
      directMediaImageUrls: unique(
        directMediaImages.map((image) => image.currentSrc || image.src).filter(Boolean)
      ),
      videoPosterUrls: unique(
        videoElements.map((video) => video.getAttribute("poster") || "").filter(Boolean)
      )
    };
  }

  function findPermalink(article) {
    const anchors = Array.from(article.querySelectorAll('a[href*="/status/"]'));

    for (const anchor of anchors) {
      try {
        const url = new URL(anchor.href, window.location.origin);
        const matched = url.pathname.match(POST_PATH_PATTERN);

        if (matched === null) {
          continue;
        }

        const xUsername = matched[1];
        const xPostId = matched[2];

        if (!xUsername || !xPostId) {
          continue;
        }

        return { xUsername, xPostId };
      } catch {
        // Ignore malformed hrefs.
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

    root.__xpaLastJsonReport = {
      filename,
      jsonText
    };

    if (typeof document === "undefined" || typeof URL === "undefined") {
      return {
        filename,
        downloaded: false,
        jsonText
      };
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
    window.setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1_000);

    return {
      filename,
      downloaded: true
    };
  }
})();
