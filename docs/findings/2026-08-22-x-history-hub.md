# X 履歴ハブ統合の実機調査（2026-08-22）

Issue #130。X が Bookmarks / Likes を「履歴（History）」ハブへ統合した件の切り分け結果。
調査対象は x.com の web UI（ログイン済み実アカウント、Chrome）。

## 何が変わったか

X は 2026-05 に Likes タブを廃止し、Bookmarks / Likes / Videos / Articles をまとめた History
ハブを導入した（[TechCrunch 2026-05-13](https://techcrunch.com/2026/05/13/x-launches-a-history-tab-for-bookmarks-likes-videos-and-articles/)）。
web でも同じ導線になっている。

| 旧 URL | 現在 |
|---|---|
| `/i/bookmarks` | `/i/history` へリダイレクト |
| `/<username>/likes` | `/i/history/likes` へリダイレクト |

- `/i/history` = 履歴ハブ。既定タブは「ブックマーク」
- `/i/history/likes` = 「いいね」タブ
- tablist は web では2つだけ（ブックマーク / いいね）
- `/i/history/videos` `/i/history/articles` はルートとしては解決するが、web では tablist も
  記事も描画されない。投稿ではないので保存対象外
- 左サイドバーの導線は「ブックマーク」から「履歴」(`/i/history`) に変更
- タブ切替は SPA client-side navigation。フルリロードなしで `location.pathname` が変わる

## 壊れていたもの

一括取り込みオーバーレイの表示判定が両方とも常に false になっていた。

- `bookmarks-import-controls.ts`: `/^\/i\/bookmarks\/?$/`
- `likes-import-controls.ts`: `/^\/[^/]+\/likes\/?$/`

## 壊れていなかったもの（実機で発火させて確認）

**like / bookmark の GraphQL 経路は無変更。** 実際に like → unlike → like、bookmark → unbookmark を
実行して XHR を観測した結果:

| operation | transport | request | response |
|---|---|---|---|
| `FavoriteTweet` | XHR POST | `variables.tweet_id` | `{"favorite_tweet":"Done"}` |
| `UnfavoriteTweet` | XHR POST | `variables.tweet_id` | `{"unfavorite_tweet":"Done"}` |
| `CreateBookmark` | XHR POST | `variables.tweet_id` | `{"tweet_bookmark_put":"Done"}` |

`intercept-like-bookmark-actions.ts` の endpoint 名一致・payload 判定、および
`observe-like-bookmark-actions.ts` の webRequest fallback はいずれも変更不要。

**タイムライン DOM も無変更。** `article[data-testid="tweet"]` / `[data-testid="cellInnerDiv"]`、
スクロールは window レベル。`find-tweet-articles.ts` と `timeline-import-controls.ts` の
収集ロジックはそのまま動く。

**オーバーレイ同期に URL watcher は不要。** `syncLikesImportControls()` は MutationObserver 起点の
`scanTweetArticles()` から毎回呼ばれ、その都度 `window.location.href` を読み直す。SPA タブ切替でも
DOM が入れ替わるため再評価される。

## 別件: タイムラインのアクションバーが環境で異なる（未解決）

ホームタイムラインの `[role="group"]` の中身が、**同じ x.com・同じ URL・同じカラム幅
(598px) でもプロファイルによって違った**。

| プロファイル | `data-testid` |
|---|---|
| 日常利用の Chrome プロファイル | `reply` / `retweet` / `like` のみ（共有ボタンは aria-label のみ。閲覧数もなし） |
| `.shared-cdp-profile` | `reply` / `retweet` / `like` / `bookmark`（閲覧数あり） |

前者では共有メニュー・`caret` メニューにもブックマーク項目がなく、タイムラインから
ブックマークする導線が存在しない。投稿詳細ページと `/i/history` には
`data-testid="bookmark"` が出る。

ウィンドウ幅（1920 / 958）でもカラム幅でも説明がつかないため、A/B 実験か
クライアント単位のフラグと推測している。**未確認**。

ネットワーク層で拾っているため拡張は壊れないが、ブックマークボタンが出ない環境では
`autoArchiveOnBookmark` の発火箇所が詳細ページと画像 lightbox に限られる。設定 UI には
「環境によっては表示されない」という条件付きの注記だけを入れてある。断定形の説明は
片方の環境で嘘になる。
