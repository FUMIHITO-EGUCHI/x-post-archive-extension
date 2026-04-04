# Finding: 引用投稿機能 設計分析

## 要件

引用投稿（quote tweet）を、X と同じように「投稿の中に投稿が入っている形」で保存・表示する。

---

## 現状の動作（バグ含む）

### 正常な動作
- `extractPostText` → `article.querySelector('[data-testid="tweetText"]')` は DOM 順で最初の要素を返すため、通常は主投稿のテキストが取れる（引用元は後方にある）
- `extractDisplayName` → `article.querySelector('[data-testid="User-Name"]')` も同様に最初 = 主投稿側

### 既存バグ（引用投稿があると壊れる）
- `extractPostImages` → `article.querySelectorAll('a[href*="/photo/"]')` は引用元コンテナ内の画像も含んでしまう
  → 引用元の画像が主投稿のメディアとして誤保存される
- `findPermalink` → 引用元へのステータスリンクより主投稿の方が DOM 順で先と仮定しているが、要確認

---

## 設計方針

### データモデル変更
- `PostRecord` に `quoted_post_id: string | null` を追加（新 DB フィールド）
- `SavePostInput` に `quoted_post_id?: string | null` を追加
- IndexedDB スキーマ定義の変更なし（インデックス不要）→ Dexie バージョンバンプのみ v10

### 保存フロー
```
Content Script
  1. extractPostFromArticle(article)  → { post, quotedPost }
  2. quotedPost が存在する場合:
       posts/save(quotedPost)   ← 先に引用元を保存
  3. posts/save({ ...post, quoted_post_id: quotedPost.x_post_id })
```
- 2件の独立した `posts/save` メッセージで対応（プロトコル変更最小）
- 引用元の保存失敗は non-fatal（主投稿は `quoted_post_id = null` で保存を続ける）

### 抽出変更（extract-post-from-article.ts）
```
exportする関数:
  extractPostFromArticle(article) → { post: SavePostInput, quotedPost: SavePostInput | null }

内部:
  findQuotedPostContainer(article): HTMLElement | null
  extractPostImages(article, exclude?: Element)  ← exclude を除外
  extractQuotedPost(container): SavePostInput | null
```

### ビューア表示
- `ArchivePostRecord` に `quoted_post?: ArchivePostRecord` を追加
- `hydrateArchivePosts` でページ内の全 `quoted_post_id` を一括 DB 参照し、マップに詰めて付与
- ビューア: 投稿カードの本文下に小さな枠で引用元カードを表示

---

## DOM調査結果（確定済み）

Playwright CDP で X.com ライブ DOM を調査した結果（2026-04-02）:

### 引用コンテナセレクタ

**`div[role="link"][tabindex="0"]`** のみがヒット。`data-testid` は存在しない。
候補セレクタ（`quotedTweet-link` / `quotedTweet` / `tweet-quoted` / `quoteTweet`）は全て 0 件。

### テキスト・ユーザー抽出

- `article` 内に `[data-testid="tweetText"]` が 2 件（引用あり時）
- DOM 順で最初 = 主投稿、コンテナ内 = 引用元（`querySelector` で自然に最初が取れる）
- `[data-testid="User-Name"]` も同様に 2 件、順序は同じ

### 画像の分離

- `quotedPhotoAnchorCount: 1`, `mainPhotoAnchorCount: 1`（各 1 件ずつ正確に分離）
- コンテナ内の `a[href*="/photo/"]` = 引用元の画像、コンテナ外 = 主投稿の画像

### 引用元の status ID 取得

**画像ありの場合:**
コンテナ内に `a[href*="/status/ID/photo/1"]` 形式のアンカーが 1 件存在。
lenient パターン `/^\/([^/]+)\/status\/(\d+)/`（`$` なし）で抽出可。

**画像なしの場合:**
コンテナ内にアンカーが 0 件。代わりに以下でキャプチャ:
```js
const captured = [];
const orig = history.pushState.bind(history);
history.pushState = (state, title, url) => captured.push(url);
container.click();  // React の onClick を発火
history.pushState = orig;
// captured[0] = "/username/status/2038929767685308557"
```
確認済み（テキストのみ引用投稿 `/4MCIJH0pT336057/status/2038929767685308557` を正常に取得）。

---

## 影響範囲

| ファイル | 変更種別 |
|---|---|
| `src/types/archive.ts` | `PostRecord`, `SavePostInput` にフィールド追加 |
| `src/db/archive-database.ts` | v10 バンプ（スキーマ変更なし） |
| `src/features/x/extract-post-from-article.ts` | 引用元分離・除外ロジック追加 |
| `src/features/x/inject-save-button.ts` または呼び出し元 | 保存呼び出しを2ステップに変更 |
| `src/features/archive/archive-service.ts` | `quoted_post_id` を `PostRecord` に書き込む |
| `src/types/viewer.ts` | `ArchivePostRecord` に `quoted_post?` 追加検討 |
| `src/features/viewer/components/viewer-app.tsx` | 引用元ネスト表示 |

---

## 未解決

- DOM調査完了後に `findQuotedPostContainer` のセレクタを確定する
- 引用元にも動画がある場合の video_candidates 取り扱い（graphql cache はポスト ID で管理されているため原則対応可能）

---

## Follow-up Finding (2026-04-02)

### 症状

- 引用元レコードの `reply_count` / `repost_count` / `like_count` を `extractEngagementCounts(container)` で取得するよう変更したが、実データでは取れていない
- 現時点では「主投稿の反応数 selector を引用コンテナ root に対して再利用してもヒットしない」可能性が高い

### Claude に依頼したい調査項目

- 引用コンテナ内に `data-testid="reply" | "retweet" | "unretweet" | "like" | "unlike"` が存在するか
- 存在しない場合、引用元反応数に相当する DOM がどの要素・属性・aria-label に入っているか
- テキストのみ引用 / 画像付き引用で DOM が分岐するか
- 反応数が省略表示されるケースで、数値抽出に使える文字列がどこにあるか
- `container.querySelector(...)` では取れず、さらに内側の別 root を起点にする必要があるか
- Save ボタン押下時に引用コンテナの click/navigation が巻き込まれる条件を特定する
- 引用元保存時にさらに引用元プロフィールへ遷移する原因が、`container.click()` / nested link / React event のどれかを切り分ける
- 保存後に viewer で引用がネスト表示にならないケースで、`quotedPost` 抽出失敗なのか `quoted_post_id` 未設定なのか、hydration 失敗なのかを切り分ける

### 再現報告（ユーザー提供）

- URL 1: `https://x.com/jack_s_daniel/status/2039017934933368904`
- URL 2: `https://x.com/Link_2011A/status/2038919309360275653`
- どちらも引用投稿
- 主投稿で Save を押すと、引用元へ遷移する
- 遷移先の引用元で Save を押すと、さらに引用元のプロフィールへ遷移する
- 保存結果も「引用のネスト」になっていない

### 成功報告（比較用）

- URL: `https://x.com/sashimi0725/status/2039343655929217224`
- この引用投稿では保存がうまく行った
- Claude には、失敗 2 件との DOM 構造差分、特に引用コンテナ内のアンカー構成と click ターゲットの違いを見てほしい

### この再現報告からの仮説（→修正済み）

- 引用元 permalink 取得のために使っていた `container.click()` が、対象によっては実際の navigation を発生させていた
  - `history.pushState` のモンキーパッチは `location.href = url` 方式のナビゲーションを防げない
  - 特にテキストのみの引用投稿（コンテナ内アンカーなし）でのみ `container.click()` が呼ばれていた

### 修正 (2026-04-03)

- `findQuotedPermalink` から `container.click()` 呼び出しを完全に削除
- アンカーが見つからない場合は null を返す（テキストのみ引用投稿の permalink 取得は断念）
- `src/features/x/extract-post-from-article.ts` の `findQuotedPermalink` 関数を単純化
- typecheck ✓ / build ✓

### Codex 側の実装メモ

- 現在の引用元反応数取得は `src/features/x/extract-post-from-article.ts` の `extractQuotedPostFromContainer` で `extractEngagementCounts(container)` を呼ぶだけ
- selector のズレが判明したら、主投稿と引用元で抽出関数を分けるか、`extractEngagementCounts(root, options)` の形に拡張するのが安全
- 現在の引用元 permalink 取得は `findQuotedPermalink(container)` 内で、アンカーが見つからない場合に `history.pushState` を monkey-patch して `container.click()` を実行している
- ここが今回の「Save で遷移する」症状の第一容疑

---

## Finding (2026-04-04): isolated world 制限の根本原因確定 + 修正 + 新仮説

### 根本原因確定（isolated world restriction）

Chrome 拡張の isolated world では `Object.keys(domElement)` が `[]` を返す。
React が DOM 要素に付与する `__reactFiber$xxx` プロパティは main world の JS ヒープに存在するが、
isolated world からは Object.keys() で列挙できない（プロパティ自体にはアクセス不可ではなく、
`Reflect.get` 等での直接参照も実際には cross-world では失敗する）。

CDP を使った調査で確認:
- main world: `fiberKey = "__reactFiber$..."` が見つかり depth≈12 で `tweet.permalink = "/k50_8/status/2038625286254997621"` を取得できる
- isolated world (`Page.createIsolatedWorld` 経由): `{ error: "no fiber key", allKeys: [] }` → 完全に見えない

### 実装した修正

**ブリッジパターン**: main world でアノテーション → isolated world で属性読み取り

```
main world (x-main.content.ts)
  └─ annotate-quoted-post-containers.ts
      ├─ Object.keys() で __reactFiber$* を取得 (main worldなのでOK)
      ├─ Fiber を最大30階層辿り memoizedProps.tweet.permalink を探す
      └─ 見つかれば div[role="link"][tabindex="0"] に data-xpa-quoted-permalink="..." を付与

isolated world (x.content.ts → extract-post-from-article.ts)
  └─ findPermalinkViaReactFiber()
      └─ container.getAttribute("data-xpa-quoted-permalink") で読み取る
```

変更ファイル:
- `src/features/x/annotate-quoted-post-containers.ts` — 新規作成
- `src/entrypoints/x-main.content.ts` — installQuotedPostContainerAnnotator() 追加
- `src/features/x/extract-post-from-article.ts` — findPermalinkViaReactFiber を属性読み取りに変更、Fiber 直接操作コードを削除

typecheck ✓ / build ✓

### ブラウザ確認結果

ユーザーが拡張機能リロード後にテスト → **依然として quoted_post_id = null、引用元未保存**。

### 新仮説: document_start タイミングによる MutationObserver 未設定

`x-main.content.ts` は `runAt: "document_start"` で動作する。
この時点では `document.body` が `null` の可能性があり、
`observer.observe(document.body, ...)` が TypeError を投げてアノテーターが無効になる。

`installGraphqlVideoResponseObserver` は `window.fetch` / XHR のパッチだけなので
document.body に依存せず問題が顕在化しない。アノテーターだけが body 依存。

確認手順:
1. 引用投稿ページを開く
2. DevTools Console で:
   ```javascript
   document.querySelector('div[role="link"][tabindex="0"]').hasAttribute('data-xpa-quoted-permalink')
   ```
   → `false` ならアノテーターが機能していない

対処案（`annotate-quoted-post-containers.ts`）:
```typescript
export function installQuotedPostContainerAnnotator(): void {
  if (document.body !== null) {
    setupAnnotator();
  } else {
    document.addEventListener("DOMContentLoaded", setupAnnotator, { once: true });
  }
}

function setupAnnotator(): void {
  annotateQuotedPostContainers();
  const observer = new MutationObserver(() => annotateQuotedPostContainers());
  // DOMContentLoaded 後なら body は確実に存在する
  observer.observe(document.body!, { childList: true, subtree: true });
}
```

### parsePermalink のフォーマット

アノテーターがセットする値は `/k50_8/status/2038625286254997621` 形式 (relative path)。
`parsePermalink` は `new URL(href, window.location.origin)` で処理するため、
relative path でも動作するはず（問題なし）。
