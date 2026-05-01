---
date: 2026-05-01
related-issue: 55
status: open
---

# Template stale UX 設計

## 問題

`fetchTweetDetail` が 401/403 を返すと `TweetDetailClientError = "auth-stale"` になり、worker が `Error("auth-stale")` を投げる。3 回失敗すると `thread_expand_queue` レコードが `status: failed, last_error: "auth-stale"` で永続化される。

ユーザーは「なぜ止まっているか」分からない。テンプレートは X 上で TweetDetail ページを開いた瞬間にしか再キャプチャされないため、気付かないまま止まり続ける。

## 根本原因

- `x-client-transaction-id` 等の動的ヘッダは時間経過で無効化される
- テンプレートはユーザーが X の投稿詳細ページを開かない限り更新されない
- `auth-stale` は特別扱いされておらず、他のエラーと同じ backoff + failed フローに入る

## 設計方針

### スキーマ変更なし

`last_error === "auth-stale"` を既存フィールドのシグナルとして使う。新テーブル・新フィールド不要。

### 2 つの改善

**1. テンプレート再キャプチャ時に auth-stale 失敗レコードを自動リセット**

`handle-runtime-message.ts` の `tweet-detail-template/set` ハンドラで、テンプレート保存後に:
```ts
await db.thread_expand_queue
  .where("last_error").equals("auth-stale")
  .and(r => r.status === "failed" || r.status === "pending")
  .modify({
    status: "pending",
    retry_count: 0,
    last_error: null,
    next_attempt_at: Date.now()
  });
```
これにより、ユーザーが X 上で任意の投稿を開くと失敗レコードが自動的に再試行キューに戻る。

**2. viewer にバナー表示**

新 runtime message `"thread-expand/auth-stale-check"`:
- Request: `{ type: "thread-expand/auth-stale-check" }`
- Response: `{ type: "thread-expand/auth-stale-check-result", hasAuthStaleItems: boolean }`
- 実装: `db.thread_expand_queue.where("last_error").equals("auth-stale").count() > 0`

新コンポーネント `<TemplateStaleNotice>` を `viewer-app.tsx` に追加:
- マウント時 + 60 秒ごとにポーリング
- `hasAuthStaleItems === true` の間だけ表示
- `hasAuthStaleItems` が `false` になれば自動消灯
- dismiss ボタン: `sessionStorage` に `"template-stale-dismissed"` を保存、reload で復活（stale が続いていれば再通知）
- 文言:
  - ja: `スレッドの自動取得が一時停止されています。X 上で任意の投稿を開くと再開します。`
  - en: `Thread expansion paused. Open any post on X to resume.`

## ファイル一覧

| ファイル | 変更内容 |
|---|---|
| `src/types/runtime.ts` | `ThreadExpandAuthStaleCheckMessage` / `ThreadExpandAuthStaleCheckResponse` 追加 |
| `src/features/runtime/handle-runtime-message.ts` | `thread-expand/auth-stale-check` ハンドラ追加、`tweet-detail-template/set` に auto-reset ロジック追加 |
| `src/features/runtime/client.ts` | `requestThreadExpandAuthStaleCheck()` 追加 |
| `src/features/viewer/components/template-stale-notice.tsx` | 新規コンポーネント |
| `src/features/viewer/components/viewer-app.tsx` | `<TemplateStaleNotice>` 追加 |

## Acceptance criteria

1. X で TweetDetail を開く → auth-stale で failed になっていたキューアイテムが pending に戻り、次のポーリングで処理が再開する
2. viewer 上にバナーが表示される（`hasAuthStaleItems === true` 時）
3. バナーの dismiss ボタンを押すと非表示、reload で再表示
4. auth-stale アイテムがなくなるとバナーが自動消灯
5. `npm run typecheck` / `npm run build` pass

## 注意点

- `modify()` は Dexie の bulk update。失敗しても既存レコードは壊れない（worst case: auto-reset されないだけ）
- `pending` に戻す際は worker が resume 済みである必要がある（#53 の配線修正と組み合わせて使う）
- バナーは viewer のみ。content script には出さない（viewer ルールに従う）
