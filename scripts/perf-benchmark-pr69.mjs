/**
 * CDP performance benchmark for PR #69 (N+1 thread count fix)
 *
 * Measures at real scale (17k+ posts):
 *   A  DB summary (post count, thread root count)
 *   B  N+1 thread count — individual count() per root (BEFORE PR #69)
 *   C  Batch thread count — single getAll() + JS aggregation (AFTER PR #69)
 *   D  Offset pagination degradation curve (offset 0/1k/5k/10k, limit 50)
 *   E  Keyword search cost (getAll + JS includes)
 *
 * Usage:
 *   1. npm run build
 *   2. powershell -ExecutionPolicy Bypass -File scripts\start-cdp-chrome.ps1
 *   3. node scripts/perf-benchmark-pr69.mjs
 */
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const CDP_PORT = 9223;
const DB_NAME = 'x-post-archive-posts-v1';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function getJSON(urlPath) {
  return new Promise((resolve, reject) => {
    http.get({ hostname: '127.0.0.1', port: CDP_PORT, path: urlPath }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); }
        catch (e) { reject(new Error(`JSON parse failed for ${urlPath}: ${e.message}`)); }
      });
    }).on('error', reject);
  });
}

function createTab(url) {
  return new Promise((resolve, reject) => {
    const opts = {
      method: 'PUT',
      hostname: '127.0.0.1',
      port: CDP_PORT,
      path: '/json/new?' + encodeURIComponent(url)
    };
    http.request(opts, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); }
        catch (e) { reject(e); }
      });
    }).on('error', reject).end();
  });
}

function evalInPage(wsUrl, expression, timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let settled = false;

    const done = (fn) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      ws.close();
      fn();
    };

    const timer = setTimeout(() => {
      done(() => reject(new Error('CDP eval timed out after ' + timeoutMs + 'ms')));
    }, timeoutMs + 5000);

    ws.onopen = () => {
      ws.send(JSON.stringify({
        id: 1,
        method: 'Runtime.evaluate',
        params: {
          expression,
          awaitPromise: true,
          returnByValue: true,
          timeout: timeoutMs
        }
      }));
    };

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id !== 1) return;
      done(() => {
        if (msg.result?.exceptionDetails) {
          const desc = msg.result.exceptionDetails.exception?.description ?? 'CDP eval exception';
          reject(new Error(desc));
        } else {
          resolve(msg.result?.result?.value ?? null);
        }
      });
    };

    ws.onerror = (err) => done(() => reject(new Error('WebSocket error: ' + String(err))));
  });
}

// Runs inside the browser context (viewer.html page, raw IDB API — no Dexie import needed)
const BENCHMARK_CODE = `
(async () => {
  const DB_NAME = ${JSON.stringify(DB_NAME)};

  function openDb(name) {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(name);
      req.onerror = () => reject(req.error ?? new Error('Failed to open IDB: ' + name));
      req.onsuccess = () => resolve(req.result);
    });
  }

  function storeCount(db) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('posts', 'readonly');
      const req = tx.objectStore('posts').count();
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result);
    });
  }

  function storeGetAll(db) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('posts', 'readonly');
      const req = tx.objectStore('posts').getAll();
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result);
    });
  }

  function indexGetAllKeys(db, indexName) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('posts', 'readonly');
      const req = tx.objectStore('posts').index(indexName).getAllKeys();
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result);
    });
  }

  function indexGetAll(db, indexName) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('posts', 'readonly');
      const req = tx.objectStore('posts').index(indexName).getAll();
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result);
    });
  }

  function countByIndexKey(db, indexName, key) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('posts', 'readonly');
      const req = tx.objectStore('posts').index(indexName).count(IDBKeyRange.only(key));
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result);
    });
  }

  // Simulates Dexie's orderBy(field).reverse().offset(N).limit(M) using a cursor
  function cursorOffsetLimit(db, indexName, offset, limit) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('posts', 'readonly');
      const req = tx.objectStore('posts').index(indexName).openCursor(null, 'prev');
      const results = [];
      let skipped = 0;
      req.onerror = () => reject(req.error);
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (!cursor || results.length >= limit) { resolve(results); return; }
        if (skipped < offset) { skipped++; cursor.continue(); return; }
        results.push(cursor.primaryKey);
        cursor.continue();
      };
    });
  }

  // Keyset on compound index [field+x_post_id], desc — matches PR #73 behavior
  function keysetCompoundLimit(db, compoundIndexName, cursorKey, limit) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('posts', 'readonly');
      const range = cursorKey === null
        ? null
        : IDBKeyRange.upperBound(cursorKey, true);
      const req = tx.objectStore('posts').index(compoundIndexName).openCursor(range, 'prev');
      const results = [];
      req.onerror = () => reject(req.error);
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (!cursor || results.length >= limit) { resolve(results); return; }
        results.push({ key: cursor.key, primaryKey: cursor.primaryKey });
        cursor.continue();
      };
    });
  }

  function hasIndex(db, indexName) {
    const tx = db.transaction('posts', 'readonly');
    return Array.from(tx.objectStore('posts').indexNames).includes(indexName);
  }

  const db = await openDb(DB_NAME);
  const result = {};

  // ── A: DB Summary ────────────────────────────────────────────────
  const totalPosts = await storeCount(db);
  const threadRootKeys = await indexGetAllKeys(db, 'thread_root_id');
  const uniqueRootIds = [...new Set(threadRootKeys.map(k => String(k)).filter(k => k && k !== 'null' && k !== 'undefined'))];

  result.summary = {
    totalPosts,
    threadPosts: threadRootKeys.length,
    uniqueRoots: uniqueRootIds.length
  };

  // Realistic page scenario: up to 50 unique roots (matches a typical viewer page load)
  const pageRootIds = uniqueRootIds.slice(0, 50);

  // ── B: N+1 — page level ─────────────────────────────────────────
  {
    const t0 = performance.now();
    for (const rootId of pageRootIds) {
      await countByIndexKey(db, 'thread_root_id', rootId);
    }
    result.n1_page = {
      queryCount: pageRootIds.length,
      elapsedMs: Math.round((performance.now() - t0) * 10) / 10
    };
  }

  // ── C: Batch — page level ────────────────────────────────────────
  // Mirrors PR #69: single anyOf-equivalent fetch + JS aggregation
  {
    const t0 = performance.now();
    const allThreadPosts = await indexGetAll(db, 'thread_root_id');
    const pageSet = new Set(pageRootIds);
    const counts = new Map(pageRootIds.map(id => [id, 0]));
    for (const post of allThreadPosts) {
      const rid = post.thread_root_id != null ? String(post.thread_root_id) : null;
      if (rid && pageSet.has(rid)) counts.set(rid, (counts.get(rid) ?? 0) + 1);
    }
    result.batch_page = {
      queryCount: 1,
      elapsedMs: Math.round((performance.now() - t0) * 10) / 10
    };
  }

  // ── B_full / C_full: all unique roots ───────────────────────────
  // B_full skipped if N > 300 to avoid multi-minute run
  if (uniqueRootIds.length <= 300) {
    const t0 = performance.now();
    for (const rootId of uniqueRootIds) {
      await countByIndexKey(db, 'thread_root_id', rootId);
    }
    result.n1_full = {
      queryCount: uniqueRootIds.length,
      elapsedMs: Math.round((performance.now() - t0) * 10) / 10,
      skipped: false
    };
  } else {
    result.n1_full = {
      queryCount: uniqueRootIds.length,
      elapsedMs: null,
      skipped: true,
      reason: 'N=' + uniqueRootIds.length + ' > 300, skipped'
    };
  }

  {
    const t0 = performance.now();
    const allThreadPosts = await indexGetAll(db, 'thread_root_id');
    const counts = new Map();
    for (const post of allThreadPosts) {
      const rid = post.thread_root_id != null ? String(post.thread_root_id) : null;
      if (rid) counts.set(rid, (counts.get(rid) ?? 0) + 1);
    }
    result.batch_full = {
      queryCount: 1,
      elapsedMs: Math.round((performance.now() - t0) * 10) / 10,
      uniqueRootsFound: counts.size
    };
  }

  // ── D: Offset pagination ─────────────────────────────────────────
  result.offsetPagination = {};
  for (const offset of [0, 1000, 5000, 10000]) {
    if (offset >= totalPosts) {
      result.offsetPagination['offset_' + offset] = { skipped: true, reason: 'offset >= totalPosts' };
      continue;
    }
    const t0 = performance.now();
    const keys = await cursorOffsetLimit(db, 'saved_at', offset, 50);
    result.offsetPagination['offset_' + offset] = {
      elapsedMs: Math.round((performance.now() - t0) * 10) / 10,
      returned: keys.length,
      skipped: false
    };
  }

  // ── F: Keyset pagination on compound [saved_at+x_post_id] ────────
  // Walks the same depths as D using PR #73's compound-index keyset; expected O(log N) per page.
  result.keysetPagination = {};
  const COMPOUND_INDEX = '[saved_at+x_post_id]';
  if (hasIndex(db, COMPOUND_INDEX)) {
    let cursorKey = null;
    let posScanned = 0;
    const targetDepths = new Set([0, 1000, 5000, 10000].filter(d => d < totalPosts));
    const recordedDepths = [];

    while (targetDepths.size > 0 && posScanned < totalPosts) {
      const t0 = performance.now();
      const page = await keysetCompoundLimit(db, COMPOUND_INDEX, cursorKey, 50);
      const elapsed = Math.round((performance.now() - t0) * 10) / 10;

      // Record measurement when reaching one of the target depths
      const depthBefore = posScanned;
      posScanned += page.length;

      for (const depth of [...targetDepths]) {
        if (depthBefore === depth) {
          result.keysetPagination['offset_' + depth] = {
            elapsedMs: elapsed,
            returned: page.length,
            skipped: false
          };
          targetDepths.delete(depth);
          recordedDepths.push(depth);
        }
      }

      if (page.length === 0) break;
      cursorKey = page[page.length - 1].key;

      // Skip ahead with no measurement until we approach the next target depth
      while (targetDepths.size > 0) {
        const nextDepth = Math.min(...targetDepths);
        if (posScanned >= nextDepth) break;
        const skipPage = await keysetCompoundLimit(db, COMPOUND_INDEX, cursorKey, Math.min(500, nextDepth - posScanned));
        if (skipPage.length === 0) break;
        cursorKey = skipPage[skipPage.length - 1].key;
        posScanned += skipPage.length;
      }
    }

    for (const depth of [0, 1000, 5000, 10000]) {
      if (depth >= totalPosts) {
        result.keysetPagination['offset_' + depth] = { skipped: true, reason: 'depth >= totalPosts' };
      }
    }
  } else {
    result.keysetPagination = { skipped: true, reason: '[saved_at+x_post_id] index missing — schema not yet migrated' };
  }

  // ── E: Keyword search ────────────────────────────────────────────
  {
    const t0 = performance.now();
    const allPosts = await storeGetAll(db);
    const getAllMs = Math.round((performance.now() - t0) * 10) / 10;

    // Pick the first word >= 4 chars from the most recent post's text
    let keyword = null;
    for (const post of allPosts) {
      if (typeof post.post_text !== 'string') continue;
      const words = post.post_text.split(' ');
      for (const w of words) {
        if (w.length >= 4 && w.length <= 20) { keyword = w; break; }
      }
      if (keyword) break;
    }

    let matchCount = 0;
    let filterMs = 0;
    if (keyword) {
      const t1 = performance.now();
      matchCount = allPosts.filter(p => typeof p.post_text === 'string' && p.post_text.includes(keyword)).length;
      filterMs = Math.round((performance.now() - t1) * 10) / 10;
    }

    result.keywordSearch = {
      keyword,
      matchCount,
      scannedCount: allPosts.length,
      getAllMs,
      filterMs,
      totalMs: Math.round((getAllMs + filterMs) * 10) / 10
    };
  }

  db.close();
  return result;
})()
`;

function formatReport(r) {
  const lines = ['', '=== XPA Performance Benchmark ===', ''];

  const s = r.summary;
  lines.push('[A] DB Summary');
  lines.push(`  Total posts : ${s.totalPosts.toLocaleString()}`);
  lines.push(`  Thread posts: ${s.threadPosts.toLocaleString()}  (have thread_root_id)`);
  lines.push(`  Unique roots: ${s.uniqueRoots.toLocaleString()}  (N for thread count hydration)`);
  lines.push('');

  const n1p = r.n1_page;
  const bp = r.batch_page;
  const ratio = bp.elapsedMs > 0 ? (n1p.elapsedMs / bp.elapsedMs).toFixed(1) : '∞';
  lines.push('[B/C] Thread count hydration — page level (up to 50 roots)');
  lines.push(`  [B] N+1   : ${n1p.queryCount} queries,  ${n1p.elapsedMs} ms  (${(n1p.elapsedMs / Math.max(n1p.queryCount, 1)).toFixed(1)} ms/query)`);
  lines.push(`  [C] Batch : ${bp.queryCount} query,    ${bp.elapsedMs} ms`);
  lines.push(`  Speedup   : ${ratio}x`);
  lines.push('');

  if (!r.n1_full.skipped) {
    const n1f = r.n1_full;
    const bf = r.batch_full;
    const ratioFull = bf.elapsedMs > 0 ? (n1f.elapsedMs / bf.elapsedMs).toFixed(1) : '∞';
    lines.push('[B/C] Thread count hydration — full DB (all unique roots)');
    lines.push(`  [B] N+1   : ${n1f.queryCount} queries,  ${n1f.elapsedMs} ms`);
    lines.push(`  [C] Batch : ${bf.queryCount} query,    ${bf.elapsedMs} ms`);
    lines.push(`  Speedup   : ${ratioFull}x`);
  } else {
    lines.push(`[B] N+1 full-DB: skipped (${r.n1_full.reason})`);
    lines.push(`[C] Batch full-DB: ${r.batch_full.elapsedMs} ms  (${r.batch_full.uniqueRootsFound} roots found)`);
  }
  lines.push('');

  lines.push('[D] Offset pagination  (saved_at desc, limit 50) — BEFORE PR #73');
  for (const [key, val] of Object.entries(r.offsetPagination)) {
    const n = key.replace('offset_', '').padStart(5);
    lines.push(val.skipped
      ? `  offset=${n}: skipped`
      : `  offset=${n}: ${val.elapsedMs} ms  (returned ${val.returned})`
    );
  }
  lines.push('');

  lines.push('[F] Keyset pagination  ([saved_at+x_post_id] desc, limit 50) — AFTER PR #73');
  if (r.keysetPagination?.skipped) {
    lines.push(`  ${r.keysetPagination.reason}`);
  } else {
    for (const [key, val] of Object.entries(r.keysetPagination)) {
      const n = key.replace('offset_', '').padStart(5);
      lines.push(val.skipped
        ? `  depth=${n}: skipped`
        : `  depth=${n}: ${val.elapsedMs} ms  (returned ${val.returned})`
      );
    }
  }
  lines.push('');

  const ks = r.keywordSearch;
  lines.push('[E] Keyword search  (getAll + JS includes)');
  lines.push(`  keyword   : "${ks.keyword ?? '(none found)'}"`);
  lines.push(`  getAll    : ${ks.getAllMs} ms  (${ks.scannedCount.toLocaleString()} posts loaded)`);
  lines.push(`  JS filter : ${ks.filterMs} ms  → ${ks.matchCount} matched`);
  lines.push(`  Total     : ${ks.totalMs} ms`);
  lines.push('');

  lines.push('--- Recommendations ---');
  const speedup = parseFloat(ratio);
  if (speedup >= 3) {
    lines.push(`✓ PR #69: ${ratio}x speedup on page hydration — merge recommended`);
  } else if (speedup >= 1.5) {
    lines.push(`△ PR #69: ${ratio}x speedup — modest improvement, still recommended`);
  } else {
    lines.push(`? PR #69: ${ratio}x speedup — verify with larger thread dataset`);
  }

  const o10k = r.offsetPagination['offset_10000'];
  if (o10k && !o10k.skipped) {
    if (o10k.elapsedMs > 500) {
      lines.push(`⚠ Offset pagination: offset=10k at ${o10k.elapsedMs}ms — consider keyset pagination (open Issue)`);
    } else {
      lines.push(`✓ Offset pagination: offset=10k at ${o10k.elapsedMs}ms — acceptable`);
    }
  }

  if (ks.totalMs > 1000) {
    lines.push(`⚠ Keyword search: ${ks.totalMs}ms total — full-scan overhead visible at this scale (open FTS Issue)`);
  } else {
    lines.push(`✓ Keyword search: ${ks.totalMs}ms — acceptable at current scale`);
  }
  lines.push('');

  return lines.join('\n');
}

async function main() {
  console.log('Connecting to CDP on port ' + CDP_PORT + '...');

  let targets;
  try {
    targets = await getJSON('/json/list');
  } catch {
    console.error('ERROR: Could not reach CDP on port ' + CDP_PORT + '. Run start-cdp-chrome.ps1 first.');
    process.exit(1);
  }

  const swTarget = targets.find(t => t.type === 'service_worker' && t.url?.endsWith('/background.js'));
  if (!swTarget) {
    console.error('ERROR: Extension service worker not found. Make sure the extension is loaded (chrome://extensions/).');
    process.exit(1);
  }

  const extIdMatch = swTarget.url.match(/^chrome-extension:\/\/([^/]+)\//);
  if (!extIdMatch) {
    console.error('ERROR: Could not parse extension ID from:', swTarget.url);
    process.exit(1);
  }
  const extId = extIdMatch[1];
  const viewerUrl = `chrome-extension://${extId}/viewer.html`;

  console.log('Extension ID:', extId);
  console.log('Opening viewer:', viewerUrl);

  const tab = await createTab(viewerUrl);
  console.log('Viewer tab opened. Waiting 3s for page context to initialize...');
  await sleep(3000);

  console.log('Running benchmark (may take 30-120s for large datasets)...');
  let result;
  try {
    result = await evalInPage(tab.webSocketDebuggerUrl, BENCHMARK_CODE, 120000);
  } catch (err) {
    console.error('ERROR during benchmark eval:', err.message);
    process.exit(1);
  }

  if (!result) {
    console.error('ERROR: Benchmark returned null. Verify the DB name and that posts exist.');
    process.exit(1);
  }

  console.log(formatReport(result));

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outFile = path.join(__dirname, 'results', `xpa-perf-benchmark-${timestamp}.json`);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(result, null, 2), 'utf8');
  console.log('Results saved to: scripts/results/xpa-perf-benchmark-' + timestamp + '.json');
}

main().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
