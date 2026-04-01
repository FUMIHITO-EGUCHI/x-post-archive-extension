/*
Usage:
1. Open the extension viewer page or the extension service worker DevTools.
2. Run this script after reproducing the likes import issue.
3. Optional: set window.__xpaInspectPostIds = ["12345"] before running.
*/

(async () => {
  const root = globalThis;
  const DB_NAME = "x-post-archive-posts-v1";
  const INTERESTING_EVENTS = new Set([
    "post.save_batch.completed",
    "post.save.duplicate_detected",
    "post.save.persisted",
    "media.persist.enqueued",
    "media.persist.started",
    "media.persist.succeeded",
    "media.persist.failed",
    "media.persist.queue_failed"
  ]);
  const db = await openDatabase(DB_NAME);
  const allLogs = await readAll(db, "logs");
  const targetPostIds = Array.isArray(root.__xpaInspectPostIds)
    ? root.__xpaInspectPostIds.filter((value) => typeof value === "string" && value.trim() !== "")
    : null;

  const logs = allLogs
    .filter((record) => INTERESTING_EVENTS.has(record.event))
    .filter((record) => {
      if (targetPostIds === null) {
        return true;
      }

      const context = record.context ?? {};
      return targetPostIds.includes(context.xPostId);
    })
    .sort((left, right) => (right.created_at ?? 0) - (left.created_at ?? 0));

  const summary = summarizeLogs(logs);

  const report = {
    createdAt: new Date().toISOString(),
    targetPostIds,
    summary,
    latest: logs.slice(0, 50)
  };
  root.__xpaArchiveLogReport = report;
  const exportResult = exportJsonReport("xpa-archive-log-report", report);

  console.group("XPA Archive Log Report");
  console.log("Summary", summary);
  console.table(
    root.__xpaArchiveLogReport.latest.map((record) => ({
      createdAt: formatTime(record.created_at),
      level: record.level,
      scope: record.scope,
      event: record.event,
      xPostId: record.context?.xPostId ?? null,
      mediaId: record.context?.mediaId ?? null,
      mediaType: record.context?.mediaType ?? null,
      message: record.message
    }))
  );
  console.log("Report saved to globalThis.__xpaArchiveLogReport");
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

  function summarizeLogs(records) {
    const countsByEvent = {};

    for (const record of records) {
      countsByEvent[record.event] = (countsByEvent[record.event] ?? 0) + 1;
    }

    return {
      total: records.length,
      byEvent: countsByEvent,
      latestFailure: records.find((record) => record.event === "media.persist.failed") ?? null,
      latestBatchSave: records.find((record) => record.event === "post.save_batch.completed") ?? null
    };
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
