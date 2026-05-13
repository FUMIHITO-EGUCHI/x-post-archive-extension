# Chrome Web Store — Submission Copy

CWS デベロッパーダッシュボードで毎回入力する文言の正本。提出時はここからコピペする。**この文書を編集するときは PR にして履歴を残すこと**（ストア表記のブレを防ぐ）。

---

## Identity

| Field | Value |
|---|---|
| Extension name (CWS display name) | **Offline X Archive** |
| Publisher / developer name | **Otyatya** |
| Developer contact email (CWS public) | `otyatya.dev@gmail.com` |
| Privacy Policy URL | `https://github.com/FUMIHITO-EGUCHI/x-post-archive-extension/blob/master/PRIVACY.md` |
| Homepage / Support URL | `https://github.com/FUMIHITO-EGUCHI/x-post-archive-extension` |
| Category | Productivity |
| Languages | English (`en`), Japanese (`ja`) |

---

## Single purpose statement

CWS は拡張の単一目的を 1 行〜数行で要求する。

### EN

> Save individual posts from X (formerly Twitter) into a local archive on the user's own device, and browse and search them later in an offline viewer. No data leaves the device.

### JA

> X（旧 Twitter）の投稿を1件ずつユーザー自身の端末内ローカルアーカイブとして保存し、後からオフラインの viewer で閲覧・検索できるようにする拡張です。保存したデータは端末外に送信されません。

---

## Short description (≤132 chars)

CWS のリスティング表示で使う短文（132 文字以内）。

### EN (≤132)

> Save X posts to a fully offline, on-device archive. Browse and search what you saved later, with no account and no servers.

### JA (≤132)

> X の投稿を完全ローカル・オフラインで保存する個人アーカイブ。後から自分の保存物をオフラインで一覧・検索できます。アカウント不要、サーバ不要。

---

## Detailed description

CWS リスティングの本文（〜16,000 字）。**プレーンテキスト**で送信される（Markdown は解釈されない）ため、コピー時の注意：

- 下記 blockquote (`>` 始まり) の **`>` プレフィックスは含めずに中身だけコピーする**
- セクション見出しは `▼` 1 文字で示している（`##` を残すと literal で表示されるため不使用）
- 太字 `**...**` も plain text では装飾されないが、可読性のため残してある。気になる場合は `**` を外す

### EN

> **Offline X Archive** is a Chrome extension that saves individual posts from X (formerly Twitter) into a local archive on your own device, so you can browse and search them later — even when you are offline.
>
> Unlike note-taking services or cloud bookmark managers, this extension is built around three constraints:
>
> 1. **Local-first.** All saved posts live in your browser's IndexedDB on your own device. Nothing is uploaded to the developer or to any third party.
> 2. **No account, no server.** There is no sign-up, no login, no syncing service, no analytics, no telemetry. The developer operates no backend.
> 3. **Reproduces the post as it looked when you saved it.** The post body, author, posted-at timestamp, attached media, the quoted post's ID, and the OP's self-reply thread context are all captured at save time.
>
> ▼ What it does
>
> - Adds a save button next to each post on X. One click stores the post locally.
> - Captures self-reply threads (the OP's reply chain to themselves) so that long-form threads and serialized comics stay together.
> - Saves a reference to the quoted post if there is one.
> - Bundles a viewer page where you can sort (by saved date, posted date, replies / reposts / likes, or random), filter (by tag, user, time range, or keyword), and inline-expand threads.
> - Lightbox view of saved images and videos with frame counters.
> - Export the whole archive as a zip, restore later in merge mode.
>
> ▼ What it does NOT do
>
> - It does not repost, like, follow, or take any action against X on your behalf.
> - It does not collect, transmit, or sell your data.
> - It does not show ads.
> - It does not require an account or a subscription.
>
> ▼ Permissions
>
> The extension requests only the permissions strictly needed to fulfill the above. Each one is explained in PRIVACY.md linked from the listing.
>
> ▼ License & source
>
> Released under the MIT License. The full source code is on GitHub. If you want to inspect, build, or fork, the repository link is in the listing.
>
> ▼ Note on use
>
> This extension is intended for personal archival of posts that you, the user, can already view while signed in to X. It does not scrape, crawl, or bypass any X access control. Please respect X's Terms of Service when using it.

### JA

> **Offline X Archive** は、X（旧 Twitter）の投稿を 1 件ずつあなたの端末内のローカルアーカイブに保存し、オフラインでも後から閲覧・検索できる Chrome 拡張です。
>
> ノートサービスやクラウド型のブックマーク管理ツールと違い、本拡張は次の3点に絞って作られています。
>
> 1. **ローカル完結。** 保存した投稿はすべて、あなたのブラウザの IndexedDB（同じ端末内）に置かれます。開発者や第三者にアップロードされることはありません。
> 2. **アカウント不要・サーバ不要。** 登録・ログイン・同期サービス・解析・telemetry のいずれもありません。開発者はサーバを一切運用しません。
> 3. **保存時点の状態を再現できる。** 投稿本文・著者・投稿日時・添付メディア・引用元 ID・OP のセルフリプライ（連投スレッド）まで、保存時の情報を取得します。
>
> ▼ できること
>
> - X の各投稿に保存ボタンを追加。1 クリックでローカルに保存します。
> - OP のセルフリプライ連投（自分自身への返信チェーン）もスレッドとしてまとめて保存。長文連投や連投漫画もバラけません。
> - 引用元投稿の ID とパーマリンクも保存します。
> - 同梱の viewer ページで、保存日／投稿日／リプライ・リポスト・いいね数／ランダムで並べ替え、タグ・ユーザー・期間・キーワードで絞り込み、スレッドはインラインで展開できます。
> - 画像・動画はライトボックスで全画面表示（コマ番号オーバーレイ付き）。
> - アーカイブ全体を zip でエクスポートし、後からマージ方式で復元できます。
>
> ▼ やらないこと
>
> - 代理での再投稿・いいね・フォロー等、X に対するアクションは一切行いません。
> - データの収集・送信・販売は一切行いません。
> - 広告は表示しません。
> - アカウント登録もサブスクリプションも不要です。
>
> ▼ 権限について
>
> 上記の機能の実現に必要な権限のみを要求します。各権限の用途は本拡張ページからリンクされる PRIVACY.md に記載しています。
>
> ▼ ライセンス・ソース
>
> MIT ライセンスで公開。ソースコード全文は GitHub にあります。検証・自前ビルド・フォークしたい方はリスティング内のリポジトリリンクから参照できます。
>
> ▼ 利用上の注意
>
> 本拡張は、利用者自身が X にサインインしている状態で既に閲覧できる投稿を、利用者自身の端末に保存する目的のためのものです。X のアクセス制御を回避したり、スクレイピング・クローリングを行うものではありません。X の利用規約を遵守してご利用ください。

---

## Permission justifications

CWS は permission ごとに正当化を入力する欄がある。1 つずつコピペできるよう分けて書く。

### `storage`

**EN:** Required to persist user settings (display preferences, viewer state) in `chrome.storage`. Without it the extension cannot remember anything between sessions.

**JA:** 表示設定や viewer の状態を `chrome.storage` に保持するために必要です。これがないとセッションをまたいで設定が保存できません。

### `unlimitedStorage`

**EN:** Required so that the local IndexedDB archive of saved posts (including cached media blobs) can grow beyond the default per-origin quota. The whole point of the extension is to keep an unbounded personal archive on the user's own device.

**JA:** 保存済み投稿のローカル IndexedDB（キャッシュ済みメディア blob を含む）を、ブラウザの既定 origin 容量制限を超えて拡張するために必要です。本拡張の目的そのものが「ユーザー自身の端末内に容量制限のない個人アーカイブを持つこと」であるため必須です。

### `cookies`

**EN:** Required to read **only** the `ct0` CSRF cookie from `x.com` / `twitter.com`. That cookie is needed to compose authenticated requests to the user's own X session's GraphQL endpoint (`TweetDetail`) so the extension can capture the full post and its thread context as the user already sees them while signed in. The cookie value never leaves the user's device and is never sent to the developer or any third party. No other cookies are read.

**JA:** `x.com` / `twitter.com` から **`ct0` CSRF cookie のみ** を読むために必要です。これはユーザー自身の X セッションの GraphQL エンドポイント（`TweetDetail`）に対する認証付きリクエストを組み立てるために必要で、ユーザーがサインイン中に既に閲覧している投稿とそのスレッド文脈を完全な形で取得するために使います。cookie の値はユーザーの端末から外に出ることはなく、開発者や第三者に送信されることもありません。その他の cookie は読みません。

### `alarms`

**EN:** Required so that the MV3 background service worker can wake up on schedule to retry failed saves and process the thread-expansion queue. Without `alarms`, the service worker would be evicted between actions and queued work could stall.

**JA:** Manifest V3 の background service worker をスケジュールで起こし、失敗した保存のリトライやスレッド展開キューの処理を進めるために必要です。`alarms` がないと service worker がアクション間で停止し、キューが進まなくなります。

### `host_permissions`: `https://x.com/*`, `https://twitter.com/*`

**EN:** Required to attach the save UI to the X interface (content script injection) and to fetch the user's own session-authenticated post and thread data via the same endpoints the user's browser already uses while signed in.

**JA:** X の画面に保存 UI を差し込む（content script の注入）ことと、ユーザーがサインインしている同じセッションを使って、ブラウザが既にアクセスしているのと同じエンドポイントから投稿・スレッドのデータを取得するために必要です。

### `host_permissions`: `https://pbs.twimg.com/*`, `https://video.twimg.com/*`

**EN:** Required to fetch media (images, videos) referenced by saved posts so that they can be rendered in the offline viewer without re-contacting X.

**JA:** 保存済み投稿が参照する画像・動画メディアを取得し、オフライン viewer 上で X に再アクセスせずに表示するために必要です。

---

## Data usage form

CWS の "Privacy practices" フォームでの回答方針。

| 項目 | 回答 |
|---|---|
| Does this item collect or use personally identifiable information? | **No** — the extension stores user-selected posts locally on the user's own device only. The developer receives nothing. |
| What categories of user data are collected, used, or sold? | **None of the above** — none of the listed categories applies because nothing leaves the device. |
| The data is **not** being sold to third parties | ✅ check |
| The data is **not** being used or transferred for purposes that are unrelated to the item's single purpose | ✅ check |
| The data is **not** being used or transferred to determine creditworthiness or for lending purposes | ✅ check |
| Single purpose declaration | 上 § Single purpose statement (EN) を貼る |
| Privacy policy URL | 上 § Identity の Privacy Policy URL |

---

## X (Twitter) trademark / ToS disclaimer

CWS は商標・サードパーティブランド使用に厳しい。提出時の注意：

- 名称 **Offline X Archive** は "X" を含むがプラットフォーム名としての言及で、`Offline X Archive` 全体が独立した固有名。`for X` / `for Twitter` 形式は CWS 規約で **禁止** されているのでこれらは使わない
- X / Twitter の **公式ロゴはアイコン・スクリーンショット・掲載文に一切使用しない**（商標違反扱い）
- 詳細説明の「利用上の注意」段落で「X のアクセス制御を回避しない／スクレイピングしない／利用規約を守る」を明示済み

---

## Source of truth for manifest

参考までに：CWS リスティング表記と \`wxt.config.ts\` / \`PRIVACY.md\` の整合は手動。リスティングを更新したらこちらも揃える。

- \`wxt.config.ts\` の \`manifest.name\` → **Offline X Archive** に揃え済み
- \`wxt.config.ts\` の \`manifest.description\` → 上 § Short description (EN) と一致済み
- \`PRIVACY.md\` 冒頭の表記 → **Offline X Archive** に揃え済み

> ✅ 上記の同期は Issue #98 で実施済み（PR ベース）。
