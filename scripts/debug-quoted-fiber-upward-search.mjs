/**
 * 調査: 引用コンテナの React Fiber を上方向に走査し、
 * memoizedProps.tweet.permalink が何段目にあるか特定する
 *
 * 実行:
 *   node scripts/debug-quoted-fiber-upward-search.mjs
 */

import { chromium } from "playwright";
import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const TARGET_URLS = [
  "https://x.com/jack_s_daniel/status/2039017934933368904",
  "https://x.com/Link_2011A/status/2038919309360275653",
];

async function main() {
  console.log("Connecting to Chrome via CDP (localhost:9222)...");
  const browser = await chromium.connectOverCDP("http://localhost:9222");
  const contexts = browser.contexts();
  if (contexts.length === 0) throw new Error("No browser contexts found.");

  const context = contexts[0];
  const results = [];

  for (const url of TARGET_URLS) {
    console.log(`\nNavigating to: ${url}`);
    let page = context.pages().find((p) => p.url().startsWith("https://x.com/"));
    if (!page) page = await context.newPage();

    await page.goto(url, { waitUntil: "domcontentloaded" });
    try {
      await page.waitForSelector('article[data-testid="tweet"]', { timeout: 10_000 });
    } catch {
      console.warn(`  article not found`);
      results.push({ url, error: "article not found" });
      continue;
    }
    await page.waitForTimeout(1500);

    const result = await page.evaluate(() => {
      const QUOTED_SELECTOR = 'div[role="link"][tabindex="0"]';
      const article = document.querySelector('article[data-testid="tweet"]');
      if (!article) return { error: "no article" };
      const container = article.querySelector(QUOTED_SELECTOR);
      if (!container) return { error: "no container" };

      const fiberKey = Object.keys(container).find((k) => k.startsWith("__reactFiber"));
      if (!fiberKey) return { error: "no fiber key" };

      // Upward traversal: log memoizedProps at each level
      const levels = [];
      let fiber = container[fiberKey];
      for (let depth = 0; depth < 100 && fiber; depth++) {
        const props = fiber.memoizedProps;
        let propsInfo = null;
        if (props && typeof props === "object") {
          const keys = Object.keys(props).slice(0, 20);
          // Check for tweet.permalink specifically
          let tweetPermalink = null;
          if (props.tweet && typeof props.tweet === "object") {
            tweetPermalink = props.tweet.permalink ?? null;
          }
          // Check for any string value containing /status/
          const statusProps = [];
          for (const key of keys) {
            const val = props[key];
            if (typeof val === "string" && val.includes("/status/")) {
              statusProps.push({ key, value: val.slice(0, 100) });
            }
          }
          propsInfo = {
            keys: keys.slice(0, 10),
            tweetPermalink,
            statusProps,
          };
        }
        if (propsInfo?.tweetPermalink || propsInfo?.statusProps?.length > 0) {
          levels.push({ depth, ...propsInfo });
        }
        fiber = fiber.return ?? null;
      }

      // Also try downward DFS from container fiber
      const downstreamFound = [];
      const rootFiber = container[fiberKey];
      const visited = new Set();
      const stack = [{ fiber: rootFiber, depth: 0 }];
      while (stack.length > 0 && downstreamFound.length < 5) {
        const { fiber: f, depth } = stack.pop();
        if (!f || visited.has(f) || depth > 50) continue;
        visited.add(f);
        const props = f.memoizedProps;
        if (props && typeof props === "object" && props.tweet && typeof props.tweet === "object") {
          const plink = props.tweet.permalink;
          if (typeof plink === "string") {
            downstreamFound.push({ depth, permalink: plink });
          }
        }
        if (f.sibling) stack.push({ fiber: f.sibling, depth });
        if (f.child) stack.push({ fiber: f.child, depth: depth + 1 });
      }

      return {
        upwardLevelsWithData: levels,
        downstreamFound,
        containerHasAnchors: container.querySelectorAll('a[href*="/status/"]').length,
      };
    });

    result.url = url;
    results.push(result);

    console.log(`  containerHasAnchors: ${result.containerHasAnchors}`);
    console.log(`  upwardLevelsWithData (count): ${result.upwardLevelsWithData?.length}`);
    if (result.upwardLevelsWithData?.length) {
      for (const level of result.upwardLevelsWithData) {
        console.log(`    depth=${level.depth} tweetPermalink=${level.tweetPermalink} statusProps=${JSON.stringify(level.statusProps)}`);
      }
    }
    console.log(`  downstreamFound: ${JSON.stringify(result.downstreamFound)}`);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `xpa-fiber-upward-search-${timestamp}.json`;
  const outputPath = join(__dirname, "results", filename);
  writeFileSync(outputPath, JSON.stringify(results, null, 2), "utf-8");
  console.log(`\nResults saved to: ${outputPath}`);
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
