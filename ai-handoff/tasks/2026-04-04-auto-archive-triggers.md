# Task Packet — いいね・ブックマーク時の自動アーカイブ

## Goal

X 上でいいね・ブックマーク操作をした際に、対象投稿を自動でアーカイブに保存する。
設定で機能を ON/OFF できる。失敗時は保存ボタンをエラー状態に変化させ、ログに記録する。

## Requested Action

実装・型チェック・ビルド確認まで行う。コミットはしない。

## In Scope

- `src/types/archive.ts` または `src/types/viewer.ts` に `ArchiveSettings` 型を追加
- `src/features/settings/archive-settings.ts` を新規作成（設定の読み書き）
- `src/features/x/intercept-like-bookmark-actions.ts` を新規作成（GraphQL インターセプト）
- `src/features/x/bootstrap-x-content-script.ts` に `installLikeBookmarkInterceptor()` を追加
- `src/features/viewer/components/settings-basic-panel.tsx` に設定UIを追加
- 失敗時の保存ボタンエラー表示（`inject-save-button.ts` に状態追加）
- 失敗をログに記録（`logger.ts` 経由）

## Out Of Scope

- いいね解除・ブックマーク解除時のアーカイブ削除
- 既にアーカイブ済みの投稿の上書き更新
- エラー時のトースト通知・モーダル等の割り込みUI

## Constraints

- TypeScript strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes。`any` 禁止
- content script は素の TypeScript を維持（React 不使用）
- 設定値は `chrome.storage.local` で永続化
- `npm run typecheck` ✓ / `npm run build` ✓ を完了条件とする

---

## 実装仕様

### 1. 設定型（`src/types/archive.ts` 等）

```typescript
export interface ArchiveSettings {
  autoArchiveOnLike: boolean;
  autoArchiveOnBookmark: boolean;
}

export const defaultArchiveSettings: ArchiveSettings = {
  autoArchiveOnLike: false,
  autoArchiveOnBookmark: false,
};
```

---

### 2. 設定の読み書き（`archive-settings.ts`）

```typescript
export async function loadArchiveSettings(): Promise<ArchiveSettings>
export async function persistArchiveSettings(settings: ArchiveSettings): Promise<void>
```

`chrome.storage.local` に `{ archiveSettings: ArchiveSettings }` として保存。
読み込み時に値が存在しない場合は `defaultArchiveSettings` を返す。

---

### 3. GraphQL インターセプト（`intercept-like-bookmark-actions.ts`）

#### 監視対象エンドポイント

| 操作 | エンドポイント（部分一致） | 使用する設定キー |
|---|---|---|
| いいね | `/i/api/graphql/*/FavoriteTweet` | `autoArchiveOnLike` |
| ブックマーク | `/i/api/graphql/*/CreateBookmark` | `autoArchiveOnBookmark` |

いいね解除（`UnfavoriteTweet`）・ブックマーク解除（`DeleteBookmark`）はアーカイブを削除しないため監視対象外。

#### 実装方針

XMLHttpRequest と fetch の両方を監視する必要がある（XのGraphQL通信はfetchを使用）。
`install-graphql-video-response-observer.ts` の実装パターンを参考にすること。

fetch インターセプト:
```typescript
const originalFetch = window.fetch;
window.fetch = async function(...args) {
  const response = await originalFetch.apply(this, args);
  // URL 判定 → response.clone() で JSON を読む → postId 抽出 → 保存処理
  return response;
};
```

#### postId の抽出

- いいね: レスポンス JSON の `data.favorite_tweet` が `"Done"` の場合、リクエスト body の `variables.tweet_id` を使用
- ブックマーク: レスポンス JSON の `data.bookmark_tweet_result.result.__typename === "Tweet"` の場合、リクエスト body の `variables.tweet_id` を使用

リクエスト body は `args[1]?.body` から取得し `JSON.parse()` する。

#### 保存処理

1. 設定を確認（`autoArchiveOnLike` / `autoArchiveOnBookmark`）
2. DOM から `postId` に対応する `<article>` 要素を `findTweetArticles()` で探す
3. 見つかった場合: `extractPostFromArticle()` で抽出 → background script へ保存メッセージ送信
4. 見つからない場合: ログに `level: "warn"`, `event: "auto-archive-article-not-found"` を記録してスキップ

#### 失敗時の処理

- 保存失敗時（background からエラーレスポンス）:
  - 対象投稿カードの保存ボタンをエラー状態（"error" 状態）に 3 秒間変化させる
  - ログに `level: "error"`, `scope: "auto-archive"`, `event: "save-failed"`, `request_id: postId` を記録

#### エクスポート

```typescript
export function installLikeBookmarkInterceptor(): void
// fetch を一度だけ上書きする（複数回呼ばれても二重登録しない）
```

---

### 4. 保存ボタンのエラー状態（`inject-save-button.ts`）

既存の `ButtonState` 型（"unsaved" | "saving" | "saved" | "error" 等）を確認し、
`"error"` 状態がなければ追加する。

エラー状態の表示:
- ボタンアイコンを ✕ または赤色の表示に変更（既存スタイルに合わせる）
- 3 秒後に自動で以前の状態（"saved" or "unsaved"）に戻す

---

### 5. Content Script への組み込み（`bootstrap-x-content-script.ts`）

```typescript
import { installLikeBookmarkInterceptor } from "./intercept-like-bookmark-actions";

// 初期化時に一度だけ呼び出す（URL 変化とは無関係）
installLikeBookmarkInterceptor();
```

---

### 6. 設定UI（`settings-basic-panel.tsx`）

「自動アーカイブ」セクションを基本設定パネルに追加:

```
□ いいね時に自動保存
□ ブックマーク時に自動保存
```

各チェックボックスの変更時に `persistArchiveSettings()` を呼び出す。
初期値は `loadArchiveSettings()` で読み込む。

---

## 確認すべき既存コード

| ファイル | 確認ポイント |
|---|---|
| `src/features/x/install-graphql-video-response-observer.ts` | fetch/XHR インターセプトのパターン |
| `src/features/x/inject-save-button.ts` | `ButtonState` の現在の定義、`setButtonState()` の使い方 |
| `src/features/x/find-tweet-articles.ts` | `findTweetArticles()` の引数・戻り値 |
| `src/features/x/extract-post-from-article.ts` | `extractPostFromArticle()` の戻り値型 |
| `src/features/x/bootstrap-x-content-script.ts` | 初期化処理の構造 |
| `src/features/viewer/components/settings-basic-panel.tsx` | 既存の設定UIのパターン |
| `src/features/logging/logger.ts` | `logger.error()` / `logger.warn()` の使い方 |

---

## Acceptance Criteria

1. 設定画面に「いいね時に自動保存」「ブックマーク時に自動保存」のチェックボックスが表示される
2. チェックを入れた状態でいいねすると、対象投稿がアーカイブに保存される
3. チェックを入れた状態でブックマークすると、対象投稿がアーカイブに保存される
4. チェックを外した状態では自動保存されない
5. 保存成功時は通常動作（特に通知なし）
6. 保存失敗時は保存ボタンが 3 秒間エラー状態になる
7. 保存失敗時にログが記録される（設定画面のアプリログタブで確認可能）
8. 既にアーカイブ済みの投稿を重複保存しない（or 上書きしても副作用がない）
9. `npm run typecheck` ✓
10. `npm run build` ✓

## Codex Plan

## Codex Result

## Changed Files

## Verification

## Remaining Issues

## Suggested Next Action
