/*
Usage:
1. Open the extension viewer page or the extension service worker DevTools.
2. Run this script in the console after a likes import attempt.
3. Optional: set window.__xpaInspectPostIds = ["12345"] before running to focus on specific posts.
*/

(async () => {
  const root = globalThis;
  const DB_NAME = "x-post-archive-posts-v1";
  const db = await openDatabase(DB_NAME);
  const targetPostIds = Array.isArray(root.__xpaInspectPostIds)
    ? root.__xpaInspectPostIds.filter((value) => typeof value === "string" && value.trim() !== "")
    : null;

  const [posts, media] = await Promise.all([
    readAll(db, "posts"),
    readAll(db, "media")
  ]);

  const mediaByPostId = new Map();

  for (const item of media) {
    const list = mediaByPostId.get(item.x_post_id);

    if (list === undefined) {
      mediaByPostId.set(item.x_post_id, [item]);
      continue;
    }

    list.push(item);
  }

  const filteredPosts =
    targetPostIds === null ? posts : posts.filter((post) => targetPostIds.includes(post.x_post_id));
  const recentPosts = [...filteredPosts]
    .sort((left, right) => (right.saved_at ?? 0) - (left.saved_at ?? 0))
    .slice(0, 30);

  const rows = recentPosts.map((post) => {
    const relatedMedia = mediaByPostId.get(post.x_post_id) ?? [];

    return {
      xPostId: post.x_post_id,
      savedAt: formatTime(post.saved_at),
      postedAt: formatTime(post.posted_at),
      mediaCount: relatedMedia.length,
      readyCount: relatedMedia.filter((item) => item.storage_status === "ready").length,
      pendingCount: relatedMedia.filter((item) => item.storage_status === "pending").length,
      failedCount: relatedMedia.filter((item) => item.storage_status === "failed").length,
      mediaTypes: [...new Set(relatedMedia.map((item) => item.media_type))].join(","),
      textLength: typeof post.post_text === "string" ? post.post_text.length : 0
    };
  });

  const summary = {
    postCount: posts.length,
    mediaCount: media.length,
    readyMediaCount: media.filter((item) => item.storage_status === "ready").length,
    pendingMediaCount: media.filter((item) => item.storage_status === "pending").length,
    failedMediaCount: media.filter((item) => item.storage_status === "failed").length,
    postsWithoutMedia: posts.filter((post) => (mediaByPostId.get(post.x_post_id) ?? []).length === 0).length,
    targetPostIds
  };

  const report = {
    createdAt: new Date().toISOString(),
    summary,
    rows,
    failedMedia: media
      .filter((item) => item.storage_status === "failed")
      .sort((left, right) => (right.saved_at ?? 0) - (left.saved_at ?? 0))
      .slice(0, 30),
    pendingMedia: media
      .filter((item) => item.storage_status === "pending")
      .sort((left, right) => (right.saved_at ?? 0) - (left.saved_at ?? 0))
      .slice(0, 30)
  };
  root.__xpaArchiveDbSummary = report;
  const exportResult = exportJsonReport("xpa-archive-db-summary", report);

  console.group("XPA Archive DB Summary");
  console.log("Summary", summary);
  console.table(rows);
  console.log("Failed media", root.__xpaArchiveDbSummary.failedMedia);
  console.log("Pending media", root.__xpaArchiveDbSummary.pendingMedia);
  console.log("Report saved to globalThis.__xpaArchiveDbSummary");
  console.log("JSON export", exportResult);
  console.groupEnd();

  function openDatabase(name) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(name);

      request.onerror = () => {
        reject(request.error ?? new Error(`Failed to open IndexedDB: ${name}`));
      };

      request.onsuccess = () => {
        resolve(request.result);
      };
    });
  }

  function readAll(dbInstance, storeName) {
    return new Promise((resolve, reject) => {
      if (!dbInstance.objectStoreNames.contains(storeName)) {
        resolve([]);
        return;
      }

      const transaction = dbInstance.transaction(storeName, "readonly");
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onerror = () => {
        reject(request.error ?? new Error(`Failed to read object store: ${storeName}`));
      };

      request.onsuccess = () => {
        resolve(Array.isArray(request.result) ? request.result : []);
      };
    });
  }

  function formatTime(value) {
    return typeof value === "number" && Number.isFinite(value)
      ? new Date(value).toISOString()
      : null;
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
