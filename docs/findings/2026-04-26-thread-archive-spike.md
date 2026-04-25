---
date: 2026-04-26
related-issue: TBD (thread-archive parent)
status: resolved
---

# Findings: スレッドアーカイブ機能 spike 結果

## 目的

OP の self-reply チェーン（漫画コマ・連投）を後から自動取得する手段を 2 案検証:

- 案 A: 隠れタブ + content script による DOM 抽出
- 案 B: 既存 GraphQL 通信から TweetDetail の template を学習し、任意 ID で再 fetch

## 結論

**案 A: 不採用**。`chrome.tabs.create({active:false})` で開いたタブは X 上で conversation 続編が描画されない。`Page.navigate`（CDP 経由）では同 URL で 5 件描画される。

**案 B: 採用**。`/i/api/graphql/<id>/TweetDetail` を MAIN world で intercept してテンプレ化、background から `chrome.cookies` + 同テンプレで再 fetch すれば、任意 ID の conversation 全件を取得できる。所要 0.4〜1.0 s/req。

## 検証環境

- Chrome 147、`.shared-cdp-profile`（dev X アカウント `@anifumi_dev` ログイン済）
- 拡張本体は `npm run build` 出力の `chrome-mv3` を `--load-extension` で読み込み
- spike コードは別ブランチ / 未 commit（findings 確定後に revert）

## 案 A 詳細

### 実装

`chrome.tabs.create({url, active:false})` → タブ load 完了待ち → content script に `tabs.sendMessage` で抽出依頼 → MutationObserver で article 出現待ち → OP filter で抽出 → タブ閉じる。

### 計測

| 試行 | サンプル | 結果 |
|---|---|---|
| baseline | tatsunoko 5 panels | totalArticleCount=1 |
| article wait 6s→15s | 同 | 同 1 件のみ |
| `active:true` | 同 | 同 1 件のみ |
| `windows.update({focused:true})` | 同 | 同 1 件のみ |
| `visibilityState` 偽装 | 同 | 同 1 件のみ |
| `window.scrollTo(bottom)` 強制 | 同 | 同 1 件のみ |
| `Page.navigate`（対照群） | 同 | 5 件描画 ✅ |

### 切り分け

- ログイン状態 OK（`accountSwitcherButton: true`、login wall 無し）
- content script 注入 OK（Save ボタンも出る）
- メッセージ往復 OK
- visibilityState は偽装で `visible` にできるが、X は他指標（おそらく RAF throttling / IntersectionObserver / focus）で background tab を識別、conversation 続編の lazy load を抑止
- `Page.navigate` 経由なら同条件で 5 件描画されるため、`chrome.tabs.create + tabs.update` 系のナビゲーションパスに固有の問題

### コスト

成立しないので無関係。仮に動いても 1 件 ~16 s（タブ生成 + load + extract + cleanup）。直列 N 件で 16N s。

## 案 B 詳細

### 実装

1. **MAIN world** で `window.fetch` と `XMLHttpRequest.prototype.open/setRequestHeader/send` を patch
2. URL に `/i/api/graphql/<id>/TweetDetail` を含む request を見つけたら、URL（operation ID 込み）/ method / headers（authorization Bearer + x-csrf-token + その他）/ variables / features / fieldToggles を template として保存
3. dispatch CustomEvent → isolated world bridge が受信
4. extension に保存 or runtime message で background へ転送
5. 任意 `focalTweetId` で template を replay（variables の focalTweetId だけ差し替え）

### 計測（一括取得テスト、x.com タブを seed として navigate 後）

| サンプル | focalTweetId | status | totalMs | OP self-reply 全件取得 |
|---|---|---|---|---|
| S1 head | 2047918634040008981 | 200 | 925 | ✅ 3 件 |
| S1 mid | 2047918964400152789 | 200 | 386 | ✅ 3 件（中央 ID 起点でも root から） |
| S2 | 2047963826310770994 | 200 | ~400 | ✅ 2 件 |
| S3 (Thread Compose 5) | 2047601569651413442 | 200 | 1001 | ✅ 5 件 + 後続続編 3 件 |

### 取得構造（Sample 3 抜粋）

```
root 2047601569651413442 (user 709404659887116292)
  └ 1578216235504 (user 同)
    └ 1587045245400
      └ 1595391844731
        └ 1603608481894 (5/5)
          └ 2047638359917617640 (続編)
            └ 2047654232187367680
              └ 1686767841847255040
```

各 tweet record に `legacy.in_reply_to_status_id_str` / `legacy.full_text` / `core.user_results.result.rest_id` / `legacy.entities.media[]` 全部含まれる。OP filter は `user_results.result.rest_id === <OP_user_id>`。

### template キャプチャ条件

- ユーザーが直近で X の任意のスレッド/単発投稿ページを開いていれば、organic に TweetDetail request が飛ぶ → 自動キャプチャ
- 拡張インストール直後は template 未取得 → 「ユーザーが X 上で何か 1 つ投稿を開く」必要
- query ID（URL パスの `<id>`）は X が deploy ごとに変えるが、organic request から hot-extract するので追従可

### Bearer / csrf 取り扱い

- `authorization: Bearer ...` は X web client が hardcode（基本不変だがデプロイで変わりうる）
- `x-csrf-token` = ct0 cookie 値。`chrome.cookies.get({domain:'x.com', name:'ct0'})` で取得可
- `auth_token` cookie は `credentials: 'include'` で自動送付（host_permissions に x.com あり）
- → background から **タブ不要**で再 fetch 可能

### ToS / rate limit

- X ToS は scraping を禁止しているが、ログイン済ユーザー本人の操作起点での internal endpoint 使用は灰色（実 BAN 報告は限定的）
- 既存の `installGraphqlVideoResponseObserver` は受動 listen のみ。spike B はそこから**自発 request** に踏み込む
- 緩和策:
  - **1 req / 5 s** の固定 throttle（安全寄り）
  - 連続失敗（429 / 401）で exponential backoff、3 回失敗で `status=failed` 保留
  - 同時並列なし（worker は singleton）
  - 自動 polling / cron は無し。likes import 完了 / 連投保存ボタン押下のような **per-user-action** にしか走らせない

## ファイル

spike 中に作った以下は revert / 削除予定:

- `src/features/x/thread-expand-spike.ts`
- `src/features/x/thread-expand-spike-content.ts`
- `src/features/x/graphql-tweet-detail-spike.ts`
- `src/features/x/graphql-tweet-detail-spike-bridge.ts`
- `src/features/x/graphql-tweet-detail-spike-driver.ts`
- `src/entrypoints/background.ts`（`__threadSpike` / `__tweetDetailSpike` 公開行）
- `src/entrypoints/x-main.content.ts`（`installTweetDetailSpike` 呼び出し）
- `src/features/x/bootstrap-x-content-script.ts`（spike installer 呼び出し）
- `scripts/run-thread-spike.mjs` / `scripts/run-tweet-detail-spike.mjs` / `scripts/probe-sw.mjs` / `scripts/reload-extension.mjs` / `scripts/inspect-page.mjs`

ただし graphql-tweet-detail-spike.ts と bridge は本実装の 80% を占めるため、**実装タスクの叩き台**として参照する想定。
