# Task Packet — ランダム表示機能

## Goal

一覧画面のソートオプションに「ランダム」を追加する。
毎回異なる順序で投稿を眺められるようにする。

## Requested Action

実装・型チェック・ビルド確認まで行う。コミットはしない。

## Design

### ソート選択 UI

- `PostSortField` に `"random"` を追加
- 一覧画面のソートセレクタに「ランダム」選択肢を追加
- 「ランダム」選択時、ソート方向（昇順/降順）は非表示またはグレーアウト

### ランダム順序の生成と一貫性

- ランダム表示は「シャッフル済み ID リスト」をセッション中に保持する方式を採用する
- 「再シャッフル」ボタン（またはランダムを再選択）で新しいシャッフルを生成する
- 「もっと読む」のページネーション中はシャッフル順を保持する

### DB 層

- `listPostsSliceBySort` でランダムが選択された場合:
  1. 全投稿の `x_post_id` のみを取得（`toCollection().primaryKeys()`）
  2. Fisher-Yates シャッフルを適用
  3. 指定 offset/limit に応じて ID を抽出し `bulkGet` でレコードを取得

  **注意**: 投稿数が多い場合（1万件超）に全 ID 取得のコストが問題になる可能性があるが、
  まずはシンプルな実装で対応し、必要に応じて最適化する。

### セッション保持

- シャッフル済み ID リストは viewer の state に保持（`useState` / `useRef`）
- viewer を閉じて再度開いた場合は新規シャッフルとする（セッションストレージには保存しない）

## In Scope

- `PostSortField` 型への `"random"` 追加（`src/types/viewer.ts`）
- `posts-repository.ts` にランダム取得関数を追加
- viewer の state でシャッフル済み ID リストを管理
- ソート UI の「ランダム」選択肢と「再シャッフル」ボタン

## Out Of Scope

- ランダム順のセッション間での永続化
- ランダム表示時のフィルタ（タグ・アカウント）との組み合わせは既存のロジックで対応可（要確認）
- DB レベルでのランダム実装（`ORDER BY RANDOM()` 相当）

## Constraints

- TypeScript strict 維持
- background / content script は変更しない

## Files Likely Involved

- `src/types/viewer.ts` — `PostSortField` に `"random"` 追加
- `src/db/repositories/posts-repository.ts` — `listPostsSliceBySort` のランダム対応
- `src/features/viewer/components/viewer-app.tsx` — state 管理・UI 追加

## Open Questions

1. ランダム表示中にタグ・アカウントフィルタを組み合わせた場合、フィルタ対象のみを
   シャッフルするか、全件シャッフル後にフィルタするか?
   → 前者（フィルタ後にシャッフル）が自然。`listPostsPage` ロジックとの統合方法を確認する。

## Result

Implemented a viewer-only random ordering mode that stays stable within a single viewer session and can be explicitly reshuffled from the archive toolbar. The viewer now generates a per-session random seed, passes it through `posts/list-page`, and the archive service uses that seed to deterministically shuffle the filtered post ID set before slicing. This keeps `Load more` consistent while still allowing a new order after pressing `再シャッフル` / `Reshuffle`.

The shuffled order itself is not persisted to storage. If the saved viewer session restores with `sortField: "random"`, the viewer generates a fresh seed on open instead of reusing the previous ordering, and it does not try to restore the old random scroll position.

## Changed Files

- `src/features/viewer/components/viewer-app.tsx`
- `src/features/archive/archive-service.ts`
- `src/db/repositories/posts-repository.ts`
- `src/types/viewer.ts`
- `src/features/viewer/viewer-session-storage.ts`
- `ai-handoff/current-task.md`
- `ai-handoff/tasks/2026-04-06-random-display.md`

## Verification

- `npm run typecheck`
- `npm run build`
- Shared CDP Chrome (`.shared-cdp-profile`, port `9223`)
  - Reloaded the unpacked extension after rebuild
  - Switched the viewer sort select to `ランダム`
  - Confirmed the sort-direction button disappears and the `再シャッフル` button appears
  - Confirmed the first `50` post IDs stayed unchanged after pressing `さらに読み込む` and expanding to `100 / 12,743件`
  - Confirmed `再シャッフル` changed the first visible `10` post IDs and reset the loaded count to `50 / 12,743件`

## Remaining Issues

- No additional issue was found during the random-order verification.
