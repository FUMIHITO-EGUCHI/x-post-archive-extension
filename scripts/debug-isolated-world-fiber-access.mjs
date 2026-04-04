/**
 * 調査: content script (isolated world) で React Fiber キーが
 * 読み取れるかどうかを CDP で検証する
 *
 * 実行:
 *   node scripts/debug-isolated-world-fiber-access.mjs
 */

import { chromium } from "playwright";

const TARGET_URL = "https://x.com/Link_2011A/status/2038919309360275653";

// Main world で実行するファイバー取得コード
const FIBER_TRAVERSAL_CODE = `(() => {
  const QUOTED_SELECTOR = 'div[role="link"][tabindex="0"]';
  const article = document.querySelector('article[data-testid="tweet"]');
  if (!article) return { error: "no article" };
  const container = article.querySelector(QUOTED_SELECTOR);
  if (!container) return { error: "no container" };

  // ファイバーキーを探す
  const keys = Object.keys(container);
  const fiberKey = keys.find(k => k.startsWith("__reactFiber"));
  if (!fiberKey) return { error: "no fiber key", allKeys: keys.slice(0, 20) };

  const fiber = container[fiberKey];
  if (!fiber || typeof fiber !== "object") return { error: "fiber not object", fiberType: typeof fiber };

  // memoizedProps を読む
  const results = [];
  let cur = fiber;
  for (let d = 0; d < 30 && cur; d++) {
    const mp = cur.memoizedProps;
    if (mp && typeof mp === "object" && mp.tweet && typeof mp.tweet === "object") {
      const plink = mp.tweet.permalink;
      if (typeof plink === "string") {
        results.push({ depth: d, permalink: plink });
      }
    }
    cur = cur.return ?? null;
  }

  return {
    fiberKey,
    fiberType: typeof fiber,
    hasMemoizedProps: "memoizedProps" in fiber,
    memoizedPropsType: typeof fiber.memoizedProps,
    results,
    containerHasAnchors: container.querySelectorAll('a[href*="/status/"]').length,
  };
})()`;

async function main() {
  console.log("Connecting to Chrome via CDP (localhost:9222)...");
  const browser = await chromium.connectOverCDP("http://localhost:9222");
  const contexts = browser.contexts();
  if (contexts.length === 0) throw new Error("No browser contexts found.");

  const context = contexts[0];
  let page = context.pages().find((p) => p.url().startsWith("https://x.com/"));
  if (!page) page = await context.newPage();

  console.log(`Navigating to: ${TARGET_URL}`);
  await page.goto(TARGET_URL, { waitUntil: "domcontentloaded" });

  try {
    await page.waitForSelector('article[data-testid="tweet"]', { timeout: 10_000 });
  } catch {
    console.error("article not found within timeout");
    await browser.close();
    return;
  }
  await page.waitForTimeout(2000);

  // ① main world で実行
  console.log("\n=== [MAIN WORLD] Fiber traversal ===");
  const mainResult = await page.evaluate(FIBER_TRAVERSAL_CODE);
  console.log(JSON.stringify(mainResult, null, 2));

  // ② CDP 直接アクセスで全 executionContext を取得
  const cdpSession = await page.context().newCDPSession(page);

  // ページのすべての実行コンテキストを取得
  const runtimeContexts = await new Promise((resolve) => {
    const found = [];
    cdpSession.on("Runtime.executionContextCreated", (evt) => {
      found.push(evt.context);
    });
    cdpSession.send("Runtime.enable").then(async () => {
      // 少し待って既存コンテキストを収集
      await new Promise(r => setTimeout(r, 500));
      resolve(found);
    });
  });

  // 現在のコンテキスト一覧を取得（別の方法）
  console.log("\n=== Execution Contexts ===");
  // Runtime.evaluate で現在のコンテキストIDを確認
  const evalResult = await cdpSession.send("Runtime.evaluate", {
    expression: "typeof window !== 'undefined' ? 'main' : 'unknown'",
    returnByValue: true,
  });
  console.log("Default context eval:", JSON.stringify(evalResult.result));

  // すべてのフレームのコンテキスト一覧を取得
  const targetInfo = await cdpSession.send("Target.getTargets");
  console.log("\nTargets:");
  for (const t of targetInfo.targetInfos) {
    console.log(`  type=${t.type} title=${t.title?.slice(0, 50)} id=${t.targetId}`);
  }

  // isolated world コンテキストを作成して実行
  console.log("\n=== [ISOLATED WORLD - via Runtime.evaluate with unique contextName] ===");
  // まず現在のコンテキストを確認
  const currentContextResult = await cdpSession.send("Runtime.evaluate", {
    expression: FIBER_TRAVERSAL_CODE,
    returnByValue: true,
    awaitPromise: false,
  });
  console.log("CDP default evaluate result:");
  if (currentContextResult.result?.value) {
    console.log(JSON.stringify(currentContextResult.result.value, null, 2));
  } else {
    console.log("No .value:", JSON.stringify(currentContextResult.result, null, 2));
    if (currentContextResult.exceptionDetails) {
      console.log("Exception:", JSON.stringify(currentContextResult.exceptionDetails, null, 2));
    }
  }

  // Page.createIsolatedWorld を使って isolated world コンテキストを作成
  console.log("\n=== [TRULY ISOLATED WORLD via Page.createIsolatedWorld] ===");
  const frameTree = await cdpSession.send("Page.getFrameTree");
  const mainFrameId = frameTree.frameTree.frame.id;
  console.log("Main frame ID:", mainFrameId);

  const isolatedWorld = await cdpSession.send("Page.createIsolatedWorld", {
    frameId: mainFrameId,
    worldName: "xpa-test-isolated",
    grantUniveralAccess: false,
  });
  console.log("Isolated world context ID:", isolatedWorld.executionContextId);

  const isolatedResult = await cdpSession.send("Runtime.evaluate", {
    expression: FIBER_TRAVERSAL_CODE,
    contextId: isolatedWorld.executionContextId,
    returnByValue: true,
    awaitPromise: false,
  });

  console.log("Isolated world fiber traversal result:");
  if (isolatedResult.result?.value) {
    console.log(JSON.stringify(isolatedResult.result.value, null, 2));
  } else {
    console.log("No .value:", JSON.stringify(isolatedResult.result, null, 2));
    if (isolatedResult.exceptionDetails) {
      console.log("Exception:", JSON.stringify(isolatedResult.exceptionDetails, null, 2));
    }
  }

  await browser.close();
  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
