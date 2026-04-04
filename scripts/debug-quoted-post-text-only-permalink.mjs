/**
 * 調査: テキストのみ引用投稿の permalink 取得手法
 *
 * 目的: container.click() を使わずに、テキストのみ引用投稿の post ID / URL を取得できるか調べる
 *
 * 前提:
 *   - Chrome を --remote-debugging-port=9222 で起動済みであること
 *   - X.com にログイン済みであること
 *
 * 実行:
 *   node scripts/debug-quoted-post-text-only-permalink.mjs
 *
 * または特定 URL を指定:
 *   QUOTED_POST_URL=https://x.com/jack_s_daniel/status/2039017934933368904 node scripts/debug-quoted-post-text-only-permalink.mjs
 *
 * 結果は scripts/results/ に JSON として保存される。
 */

import { chromium } from "playwright";
import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const TARGET_URLS = [
  // テキストのみ引用投稿（失敗ケース）
  "https://x.com/jack_s_daniel/status/2039017934933368904",
  "https://x.com/Link_2011A/status/2038919309360275653",
  // 画像付き引用投稿（成功ケース、比較用）
  "https://x.com/sashimi0725/status/2039343655929217224",
];

const SINGLE_URL = process.env["QUOTED_POST_URL"];
const URLS_TO_TEST = SINGLE_URL ? [SINGLE_URL] : TARGET_URLS;

async function main() {
  console.log("Connecting to Chrome via CDP (localhost:9222)...");

  const browser = await chromium.connectOverCDP("http://localhost:9222");
  const contexts = browser.contexts();

  if (contexts.length === 0) {
    throw new Error("No browser contexts found. Is Chrome running with --remote-debugging-port=9222?");
  }

  const context = contexts[0];
  const results = [];

  for (const url of URLS_TO_TEST) {
    console.log(`\nNavigating to: ${url}`);

    let page = context.pages().find((p) => p.url().startsWith("https://x.com/"));

    if (!page) {
      page = await context.newPage();
    }

    await page.goto(url, { waitUntil: "domcontentloaded" });

    try {
      await page.waitForSelector('article[data-testid="tweet"]', { timeout: 10_000 });
    } catch {
      console.warn(`  article not found on ${url}`);
      results.push({ url, error: "article not found" });
      continue;
    }

    // 描画安定化
    await page.waitForTimeout(1500);

    const result = await page.evaluate(investigateQuotedContainer);
    result.url = url;
    results.push(result);

    console.log(`  containerFound: ${result.containerFound}`);
    console.log(`  hasStatusAnchors: ${result.hasStatusAnchors}`);
    console.log(`  textOnlyQuote: ${result.textOnlyQuote}`);

    if (result.containerFound) {
      console.log(`  dataset: ${JSON.stringify(result.containerDataset)}`);
      console.log(`  allAttributes: ${JSON.stringify(result.allAttributes)}`);
      console.log(`  reactPropsKeys: ${JSON.stringify(result.reactPropsKeys)}`);
      console.log(`  onClickHasStatusUrl: ${result.onClickHasStatusUrl}`);
      console.log(`  onClickSource: ${result.onClickSource?.slice(0, 200)}`);
      console.log(`  timeParentTag: ${result.timeParentTag}`);
      console.log(`  timeAncestorAnchorHref: ${result.timeAncestorAnchorHref}`);
      console.log(`  allHrefElements: ${JSON.stringify(result.allHrefElements)}`);
      console.log(`  fiberSearchFound (count): ${result.fiberSearchFound?.length}`);
      if (result.fiberSearchFound?.length) {
        console.log(`  fiberSearchFound: ${JSON.stringify(result.fiberSearchFound.slice(0, 5))}`);
      }
      console.log(`  userNameLinks: ${JSON.stringify(result.userNameLinks)}`);
    }
  }

  // 結果保存
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `xpa-quoted-text-only-permalink-${timestamp}.json`;
  const outputPath = join(__dirname, "results", filename);
  writeFileSync(outputPath, JSON.stringify(results, null, 2), "utf-8");

  console.log(`\nResults saved to: ${outputPath}`);
  await browser.close();
}

/**
 * ページ内で実行される調査関数（page.evaluate に渡す）
 * serializable な値のみ返すこと。
 */
function investigateQuotedContainer() {
  const QUOTED_SELECTOR = 'div[role="link"][tabindex="0"]';

  const article = document.querySelector('article[data-testid="tweet"]');
  if (!article) return { containerFound: false, error: "no article" };

  const container = article.querySelector(QUOTED_SELECTOR);
  if (!container) return { containerFound: false };

  const statusAnchors = Array.from(container.querySelectorAll('a[href*="/status/"]'));
  const textOnlyQuote = statusAnchors.length === 0;

  // ── 基本情報 ──────────────────────────────────────────────────────────────
  const containerDataset = Object.fromEntries(Object.entries(container.dataset));

  const allAttributes = {};
  for (const attr of container.attributes) {
    allAttributes[attr.name] = attr.value;
  }

  // ── __reactProps$ ─────────────────────────────────────────────────────────
  const reactPropsKey = Object.keys(container).find((k) => k.startsWith("__reactProps"));
  let reactPropsKeys = null;
  let onClickSource = null;
  let onClickHasStatusUrl = false;

  if (reactPropsKey) {
    const props = container[reactPropsKey];
    reactPropsKeys = Object.keys(props);

    if (typeof props.onClick === "function") {
      onClickSource = props.onClick.toString().slice(0, 500);
      onClickHasStatusUrl = onClickSource.includes("/status/");
    }
  }

  // ── 全 <a> 要素 ───────────────────────────────────────────────────────────
  const allAnchors = Array.from(container.querySelectorAll("a")).map((a) => ({
    href: a.getAttribute("href"),
    text: a.textContent?.trim().slice(0, 60),
  }));

  // ── href 属性を持つ全要素（a 以外も） ────────────────────────────────────
  const allHrefElements = Array.from(container.querySelectorAll("[href]")).map((el) => ({
    tag: el.tagName,
    href: el.getAttribute("href"),
  }));

  // ── <time> 要素と親アンカー ───────────────────────────────────────────────
  const timeEl = container.querySelector("time");
  let timeParentTag = null;
  let timeAncestorAnchorHref = null;

  if (timeEl) {
    timeParentTag = timeEl.parentElement?.tagName ?? null;

    let ancestor = timeEl.parentElement;
    for (let i = 0; i < 10 && ancestor && ancestor !== container; i++) {
      if (ancestor.tagName === "A") {
        timeAncestorAnchorHref = ancestor.getAttribute("href");
        break;
      }
      ancestor = ancestor.parentElement;
    }
  }

  // ── User-Name リンク ──────────────────────────────────────────────────────
  const userNameEl = container.querySelector('[data-testid="User-Name"]');
  const userNameLinks = userNameEl
    ? Array.from(userNameEl.querySelectorAll("a[href]")).map((a) => ({
        href: a.getAttribute("href"),
        text: a.textContent?.trim().slice(0, 40),
      }))
    : [];

  // ── __reactFiber$ memoizedProps DFS 走査 ─────────────────────────────────
  // container を root とする fiber ツリーを DFS で走査し、/status/ を含む props を探す
  const fiberSearchFound = [];
  const fiberKey = Object.keys(container).find((k) => k.startsWith("__reactFiber"));

  if (fiberKey) {
    const visited = new Set();
    const stack = [container[fiberKey]];

    while (stack.length > 0 && fiberSearchFound.length < 20) {
      const fiber = stack.pop();
      if (!fiber || visited.has(fiber)) continue;
      visited.add(fiber);

      const props = fiber.memoizedProps;

      if (props && typeof props === "object") {
        for (const propName of ["href", "to", "url", "as", "pathname"]) {
          const val = props[propName];
          if (typeof val === "string" && val.includes("/status/")) {
            fiberSearchFound.push({ prop: propName, value: val });
          }
        }

        if (typeof props.onClick === "function") {
          const src = props.onClick.toString();
          if (src.includes("/status/")) {
            fiberSearchFound.push({ prop: "onClick", value: src.slice(0, 300) });
          }
        }
      }

      if (fiber.sibling) stack.push(fiber.sibling);
      if (fiber.child) stack.push(fiber.child);
    }
  }

  // ── 親要素の属性 ──────────────────────────────────────────────────────────
  const parentEl = container.parentElement;
  const parentAttributes = parentEl
    ? Object.fromEntries(Array.from(parentEl.attributes).map((a) => [a.name, a.value]))
    : {};

  return {
    containerFound: true,
    textOnlyQuote,
    hasStatusAnchors: statusAnchors.length > 0,
    containerDataset,
    allAttributes,
    reactPropsKey: reactPropsKey ?? null,
    reactPropsKeys,
    onClickSource,
    onClickHasStatusUrl,
    allAnchors,
    allHrefElements,
    timeParentTag,
    timeAncestorAnchorHref,
    userNameLinks,
    fiberSearchFound,
    parentAttributes,
  };
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
