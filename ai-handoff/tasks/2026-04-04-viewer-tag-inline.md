# Task Packet — 投稿へのタグ登録UI（インラインオーバーレイ）

## Goal

投稿一覧の各カードから直接タグを追加・除去できるオーバーレイUIを実装する。
既存タグからの選択と新規タグ作成を1つのオーバーレイに統合する。

## Requested Action

実装・型チェック・ビルド確認まで行う。コミットはしない。

## In Scope

- `src/types/runtime.ts` にメッセージ型 2 種を追加（`post_tag.add`、`post_tag.remove`）
- `src/features/archive/archive-service.ts` に `addPostTagByName` / `removePostTagByName` を追加
- `src/features/runtime/handle-runtime-message.ts` にハンドラーを追加
- `src/features/viewer/components/tag-picker-overlay.tsx` を新規作成（オーバーレイUI本体）
- 投稿カードに「タグ追加」ボタンを追加し、オーバーレイを開く処理を組み込む
- `viewer-app.tsx` 側でオーバーレイの開閉 state を管理し、タグ更新後に `availableTags` を再取得

## Out Of Scope

- タグ絞り込み以外の検索（ユーザーフィルタなど）
- ドラッグ＆ドロップでのタグ並び替え
- ビルトインタグ（`system_key != null`）の追加・除去（UI から非表示にする）

## Constraints

- TypeScript strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes。`any` 禁止
- viewer UI（React）は `src/features/viewer/` に限定
- content script / background は素の TypeScript を維持
- DB 操作はトランザクションで原子的に実行
- `npm run typecheck` ✓ / `npm run build` ✓ を完了条件とする

---

## 実装仕様

### 1. Runtime メッセージ（`src/types/runtime.ts`）

既存の message union 型に追加:

```typescript
// Request
{ type: "post_tag.add"; postId: string; displayName: string }
{ type: "post_tag.remove"; postId: string; normalizedName: string }

// Response
// post_tag.add 成功
{ type: "post_tag.add"; ok: true; postTag: PostTagRecord }
// post_tag.add 失敗（タグ正規化後に空文字など）
{ type: "post_tag.add"; ok: false; error: string }

// post_tag.remove
{ type: "post_tag.remove"; ok: true }
{ type: "post_tag.remove"; ok: false; error: string }
```

---

### 2. Service 層（`archive-service.ts`）

#### `addPostTagByName(postId, displayName)`

```
入力: postId: string, displayName: string
出力: { ok: true; postTag: PostTagRecord } | { ok: false; error: string }
```

処理:
1. `normalizeTagName(displayName)` で `normalized_name` を計算
2. 空文字になった場合は `{ ok: false, error: "empty-name" }` を返す
3. `getTagByNormalizedName()` で既存タグを検索
4. 存在しない場合: `addTag()` で新規作成
5. `getPostTagByNormalizedName(postId, normalized_name)` で重複チェック
6. 既に付与済みの場合はそのまま `{ ok: true, postTag: existing }` を返す
7. `addPostTag()` で `post_tags` にレコード追加（source: "manual"）
8. `{ ok: true, postTag }` を返す

#### `removePostTagByName(postId, normalizedName)`

```
入力: postId: string, normalizedName: string
出力: { ok: true } | { ok: false; error: string }
```

処理:
1. `getPostTagByNormalizedName(postId, normalizedName)` でレコード取得
2. 存在しない場合は `{ ok: false, error: "not-found" }` を返す
3. `deletePostTag(postTagId)` で削除
4. `{ ok: true }` を返す

---

### 3. オーバーレイUI（`tag-picker-overlay.tsx`）

#### Props

```typescript
interface TagPickerOverlayProps {
  postId: string;
  currentPostTags: PostTagRecord[];    // 現在この投稿に付与済みのタグ
  allTagSummaries: TagSummary[];       // 全タグ一覧（viewer-app.tsx が持つ availableTags）
  onAdd: (displayName: string) => Promise<void>;
  onRemove: (normalizedName: string) => Promise<void>;
  onClose: () => void;
  language: ArchiveLanguage;
}
```

#### レイアウト

```
┌──────────────────────────────┐
│ [テキスト入力: タグを入力...] │
├──────────────────────────────┤
│ ✓ タグA           (12件)     │  ← 付与済み（チェックマーク表示）
│   タグB            (8件)     │
│   タグC            (3件)     │
│ ─────────────────────────── │
│ + "入力値" を新規作成         │  ← 一致する既存タグがない場合のみ表示
└──────────────────────────────┘
```

#### 挙動

- テキスト入力で候補リストをインクリメンタル絞り込み（`normalizeTagName()` で比較）
- `system_key != null` のタグは候補に表示しない
- 付与済みタグ（`currentPostTags` 内に `normalizedName` が存在する）には ✓ を表示
- 付与済みタグをクリック → `onRemove()` 呼び出し
- 未付与タグをクリック → `onAdd()` 呼び出し
- 「新規作成」行をクリック → `onAdd(inputValue)` 呼び出し（入力値と完全一致する既存タグがない場合のみ表示）
- キーボード操作: ↑↓ で候補フォーカス移動、Enter で選択、Escape で閉じる
- オーバーレイ外クリックで閉じる（`onClose()` 呼び出し）

#### 配置

- `viewer-app.tsx` で `tagPickerPostId: string | null` state を管理
- 投稿カードのタグエリア末尾に「＋」ボタンを配置
- ボタンクリックで `setTagPickerPostId(postId)`
- オーバーレイは `position: absolute` で投稿カードに近い位置に表示（portal 不要）
- z-index は既存モーダルより低い値で構わない

---

### 4. 投稿カードへの組み込み

- 投稿カードに付与済みタグを表示している箇所を確認し、末尾に「＋」ボタンを追加
- ボタンは hover 時に表示してもよい（既存スタイルに合わせる）
- タグ追加・除去後は `requestTagSummaries()` を再取得して `availableTags` を更新
- 表示中の投稿の `post_tags` も更新する（再取得 or ローカル更新）

---

## 確認すべき既存コード

| ファイル | 確認ポイント |
|---|---|
| `src/features/archive/archive-service.ts` | `addTag()`, `addPostTag()`, `deletePostTag()` の実装パターン |
| `src/db/repositories/post-tags-repository.ts` | `getPostTagByNormalizedName()`, `addPostTag()`, `deletePostTag()` の引数・戻り値 |
| `src/db/repositories/tags-repository.ts` | `getTagByNormalizedName()`, `addTag()` の引数・戻り値 |
| `src/types/runtime.ts` | 既存メッセージ union 型の形式 |
| `src/features/runtime/handle-runtime-message.ts` | ハンドラーの追加パターン |
| `src/features/viewer/components/viewer-app.tsx` | 投稿カードのレンダリング箇所、`availableTags` の管理 |
| `src/features/settings/archive-language.ts` | `normalizeTagName()` の所在確認 |

---

## Acceptance Criteria

1. 投稿カードに「＋」ボタンが表示される
2. ボタンクリックでオーバーレイが開く
3. オーバーレイにタグ候補一覧が表示される（`system_key != null` は除外）
4. テキスト入力で候補が絞り込まれる
5. 付与済みタグに ✓ が表示される
6. 付与済みタグをクリックすると除去される
7. 未付与タグをクリックすると付与される
8. 入力値と完全一致する既存タグがない場合のみ「新規作成」行が表示される
9. 新規作成をクリックするとタグが作成・付与される
10. Escape キー / オーバーレイ外クリックで閉じる
11. タグ追加・除去後に `availableTags` が更新される
12. `npm run typecheck` ✓
13. `npm run build` ✓

## Codex Plan

## Codex Result

- Inline tag editing is already implemented in the codebase.
- Added runtime messages `post_tag.add` and `post_tag.remove` in [src/types/runtime.ts](/c:/Users/kurah/Documents/Git/x-post-archive-extension/src/types/runtime.ts).
- Added archive-service handlers `addPostTagByName()` and `removePostTagByName()` in [src/features/archive/archive-service.ts](/c:/Users/kurah/Documents/Git/x-post-archive-extension/src/features/archive/archive-service.ts).
- Wired the runtime handlers in [src/features/runtime/handle-runtime-message.ts](/c:/Users/kurah/Documents/Git/x-post-archive-extension/src/features/runtime/handle-runtime-message.ts) and the viewer-side client calls in [src/features/runtime/client.ts](/c:/Users/kurah/Documents/Git/x-post-archive-extension/src/features/runtime/client.ts).
- Added the inline editor UI in [src/features/viewer/components/tag-picker-overlay.tsx](/c:/Users/kurah/Documents/Git/x-post-archive-extension/src/features/viewer/components/tag-picker-overlay.tsx) and connected it from [src/features/viewer/components/viewer-app.tsx](/c:/Users/kurah/Documents/Git/x-post-archive-extension/src/features/viewer/components/viewer-app.tsx).
- The repository layer already supports the required post-tag add/remove lookups in [src/db/repositories/post-tags-repository.ts](/c:/Users/kurah/Documents/Git/x-post-archive-extension/src/db/repositories/post-tags-repository.ts).

## Changed Files

- `src/types/runtime.ts`
- `src/features/archive/archive-service.ts`
- `src/features/runtime/handle-runtime-message.ts`
- `src/features/runtime/client.ts`
- `src/features/viewer/components/tag-picker-overlay.tsx`
- `src/features/viewer/components/viewer-app.tsx`
- `src/db/repositories/post-tags-repository.ts`

## Verification

- `npm run typecheck`
- `npm run build`
- Code inspection confirmed the viewer can open the inline tag picker, add manual tags, remove existing manual tags, exclude built-in tags from editable suggestions, and refresh `availableTags` after mutations.

## Remaining Issues

- No active blocker is recorded for this task.
- If a future task expands inline editing UX, use a new task rather than reopening this packet as unfinished MVP scope.

## Suggested Next Action

- Keep this task closed. Any future enhancements should be handled as a follow-up task.
