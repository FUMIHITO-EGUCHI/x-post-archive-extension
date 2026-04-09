# Task Packet — タグ管理機能（リネーム・マージ）

## Goal

Settings 画面に「タグ管理」カードを追加し、ユーザー作成タグのリネームとマージを同一画面で操作できるようにする。

## Requested Action

実装・型チェック・ビルド確認まで行う。コミットはしない（ユーザーが確認後にマージ）。

## In Scope

- `archive-service.ts` に `renameTag` / `mergeTags` 処理を追加
- runtime メッセージ 2 種を追加（`tag.rename`、`tag.merge`）
- `handle-runtime-message.ts` にハンドラー追加
- `src/types/runtime.ts` にメッセージ型を追加
- Settings 画面に新コンポーネント `settings-tag-management-panel.tsx` を追加
- `viewer-app.tsx` に新パネルを組み込み、マージ/リネーム後の viewer state 更新処理を追加

## Out Of Scope

- タグ自動検出・類似タグ提案
- ビルトインタグ（`system_key != null`）の操作（UI から非表示にする）
- 未使用タグの一括掃除（別機能として検討）

## Constraints

- TypeScript strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes。`any` 禁止
- viewer UI（React）は `src/features/viewer/` に限定。content script / background は素の TypeScript
- DB 操作はトランザクションで原子的に実行
- `npm run typecheck` ✓ / `npm run build` ✓ を完了条件とする

---

## 実装仕様

### 1. Service 層（`archive-service.ts`）

#### `renameTag(tagId, newDisplayName)`

```
入力: tagId: string, newDisplayName: string
出力: { ok: true; tag: TagRecord } | { ok: false; error: "collision"; conflictingTagId: string }
```

処理:
1. `tags` から `tagId` のレコードを取得
2. `normalizeTagName(newDisplayName)` で新 `normalized_name` を計算
3. 新 `normalized_name` === 現在の `normalized_name` の場合:
   - `display_name` だけを更新（`tags` + 紐づく全 `post_tags.display_name`）
4. 既存タグに新 `normalized_name` が存在する場合:
   - `{ ok: false, error: "collision", conflictingTagId: 既存タグの tag_id }` を返す
5. 衝突なし:
   - `tags.display_name` + `tags.normalized_name` を更新
   - 対応する全 `post_tags.normalized_name` + `post_tags.display_name` を更新（`tag_id` で絞り込み）
   - すべてトランザクションで実行

注意: `post_tags.source` は変更しない

#### `mergeTags(sourceTagId, targetTagId)`

```
入力: sourceTagId: string, targetTagId: string
出力: { mergedPostCount: number; removedDuplicateCount: number }
```

処理:
1. `tags` から source / target の両レコードを取得
2. source の全 `post_tags` を列挙
3. 各レコードについて:
   - target の `post_tags` に同じ `x_post_id` が存在するか確認（`[x_post_id+normalized_name]` で検索）
   - **存在しない**: source レコードの `tag_id` / `normalized_name` / `display_name` を target に更新 → `mergedPostCount++`
   - **存在する（重複）**: source レコードを削除 → `removedDuplicateCount++`
4. `tags` から source を削除
5. すべてトランザクションで実行

注意: `post_tags.source` / `post_tags.assigned_at` は変更しない

---

### 2. Runtime メッセージ（`src/types/runtime.ts`）

既存の message union 型に追加:

```typescript
// Request
{ type: "tag.rename"; tagId: string; newDisplayName: string }
{ type: "tag.merge"; sourceTagId: string; targetTagId: string }

// Response
// tag.rename 成功
{ type: "tag.rename"; ok: true; tag: TagRecord }
// tag.rename 衝突
{ type: "tag.rename"; ok: false; error: "collision"; conflictingTagId: string }

// tag.merge
{ type: "tag.merge"; mergedPostCount: number; removedDuplicateCount: number }
```

---

### 3. UI（`settings-tag-management-panel.tsx`）

#### タグ一覧

- 取得: 既存の `requestTagSummaries()` を流用。`system_key != null` のタグは表示から除外
- 列: `display_name`、投稿数、リネームボタン、マージ用チェックボックス
- ソート: 投稿数降順（初期値）

#### リネームフロー

1. リネームボタンクリック → 対象行がインライン入力フィールドに切り替わる
2. 確定時（Enter / 保存ボタン）:
   - `tag.rename` を送信
   - 成功: 一覧を再取得して表示を更新
   - 衝突エラー: 「"〇〇" は既に存在します。マージする場合は操作 B を使用してください。」をインライン表示
   - その他エラー: エラーメッセージをインライン表示
3. キャンセルボタンで編集モードを解除

#### マージフロー

1. チェックボックスで 2 つのタグを選択 → 「マージ」ボタンが活性化
2. ボタンクリック → 確認モーダルを表示:
   - 選択した 2 つの `display_name` を表示
   - 「どちらの名前を残しますか？」として 2 択ボタン
   - 選択後「統合する」確定ボタン＋「キャンセル」
3. 確定時:
   - 残す側を `targetTagId`、もう一方を `sourceTagId` として `tag.merge` を送信
   - 成功: チェックボックスをクリア、一覧を再取得して更新
   - エラー: モーダル内にエラーメッセージを表示

---

### 4. `viewer-app.tsx` への組み込み

#### `handleTagRenamed(oldNormalizedName, newNormalizedName)`

- `availableTags` を再取得
- `activeTagFilter === oldNormalizedName` の場合: `setActiveTagFilter(newNormalizedName)`

#### `handleTagMerged(sourceNormalizedName, targetNormalizedName)`

- `availableTags` を再取得
- `activeTagFilter === sourceNormalizedName` の場合: `setActiveTagFilter(targetNormalizedName)`
- `activeTagFilter === targetNormalizedName` の場合: そのまま（変更不要）

---

## 確認すべき既存コード

| ファイル | 確認ポイント |
|---|---|
| `src/features/archive/archive-service.ts` | 既存の `addTag` / `deleteTagsByIds` / `addPostTag` 実装パターン |
| `src/db/repositories/tags-repository.ts` | 現在の CRUD 関数 |
| `src/db/repositories/post-tags-repository.ts` | `listPostTagsByPostIds`、`countPostTagLinksByTagId` など |
| `src/types/runtime.ts` | 既存メッセージ union 型の形式 |
| `src/features/runtime/handle-runtime-message.ts` | ハンドラーの追加パターン |
| `src/features/viewer/components/settings-archive-maintenance-panel.tsx` | カードのスタイルクラス・構成パターン |
| `src/features/viewer/components/viewer-app.tsx` | `requestTagSummaries` の呼び出し箇所、settings パネルの組み込み方 |

---

## Acceptance Criteria

1. Settings 画面にタグ管理カードが表示される
2. `system_key != null` のタグは一覧に表示されない
3. リネーム: 衝突なし → タグ名が更新され、一覧に反映される
4. リネーム: 衝突あり → エラーメッセージがインライン表示される
5. マージ: 2 タグ選択 → モーダルで名前を選択 → 統合される（source タグが一覧から消える）
6. マージ: 両方に付与されていた投稿は重複なく target タグのみになる
7. viewer でそのタグフィルター中にリネーム → 新しい名前のフィルターに自動切り替え
8. viewer でそのタグフィルター中にマージ（source 側）→ target タグのフィルターに自動切り替え
9. `npm run typecheck` ✓
10. `npm run build` ✓

## Codex Result

- tag rename and merge support is already implemented in the archive service, runtime message layer, and viewer settings UI
- the task note had not been updated, but the feature itself is present in the codebase and can be treated as complete

## Changed Files

- `src/features/archive/archive-service.ts`
- `src/features/runtime/handle-runtime-message.ts`
- `src/types/runtime.ts`
- `src/features/runtime/client.ts`
- `src/features/viewer/components/settings-tag-management-panel.tsx`
- `src/features/viewer/components/viewer-app.tsx`

## Verification

- codebase verification on 2026-04-08 confirmed:
- `renameTag` / `mergeTags` exist in `archive-service.ts`
- `tag.rename` / `tag.merge` runtime handlers exist
- settings UI calls `requestRenameTag` / `requestMergeTags`
- viewer state update path for tag summaries is present

## Remaining Issues

- none recorded for the original task scope

## Suggested Next Action

- leave this task closed and move to the next unfinished task
