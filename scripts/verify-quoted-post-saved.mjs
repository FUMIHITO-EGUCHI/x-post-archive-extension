import { chromium } from "playwright";

const browser = await chromium.connectOverCDP("http://localhost:9222");
const contexts = browser.contexts();
const context = contexts[0];

// x.com のページを探す（ナビゲートせずに IndexedDB にアクセス）
// sashimi ページを使う（安定している可能性が高い）
const page = context.pages().find((p) => p.url().includes("sashimi"))
  ?? context.pages().find((p) => p.url().startsWith("https://x.com/"));

if (!page) {
  console.log("No x.com page found");
  await browser.close();
  process.exit(1);
}

console.log("Using page:", page.url());

const result = await page.evaluate(async () => {
  return new Promise((resolve) => {
    const req = indexedDB.open("xpa-archive");
    req.onsuccess = (e) => {
      const db = e.target.result;
      const tx = db.transaction("posts", "readonly");
      const store = tx.objectStore("posts");
      const all = store.getAll();
      all.onsuccess = () => {
        const posts = all.result
          .sort((a, b) => b.saved_at - a.saved_at)
          .slice(0, 5)
          .map((p) => ({
            x_post_id: p.x_post_id,
            x_username: p.x_username,
            saved_at: new Date(p.saved_at).toISOString(),
            quoted_post: p.quoted_post
              ? {
                  x_post_id: p.quoted_post.x_post_id,
                  x_username: p.quoted_post.x_username,
                  post_url: p.quoted_post.post_url,
                }
              : null,
          }));
        resolve(posts);
      };
      all.onerror = () => resolve({ error: "getAll failed" });
    };
    req.onerror = () => resolve({ error: req.error?.message });
  });
});

console.log(JSON.stringify(result, null, 2));
await browser.close();
