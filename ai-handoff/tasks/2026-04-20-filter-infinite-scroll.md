# Task Packet

## Meta
- status: active
- owner: Codex
- branch: master
- priority: normal
- files_in_scope: src/features/viewer/components/unified-filter-modal.tsx, src/entrypoints/viewer/style.css
- blocked_by: none
- related_findings: none
- needs_from_claude: none
- handoff_to_codex: unified-filter-modal のユーザー絞り込み・タグ絞り込みパネルの「さらに表示」ボタンを廃止し、無限スクロールに変更する
- summary:

## Goal

`unified-filter-modal.tsx` 内のユーザーフィルターパネルとタグフィルターパネルにある「さらに表示」ボタンを廃止し、リスト末尾へのスクロールで自動的に続きを読み込む無限スクロールに変更する。

## Requested Action

要件整理済み。設計・実装・型チェック・ビルド確認まで行う。コミットはしない。

## In Scope

- `unified-filter-modal.tsx` の `UserFilterPanel` 内「さらに表示」ボタン削除 → 無限スクロール化
- `unified-filter-modal.tsx` の `TagFilterPanel` 内「さらに表示」ボタン削除 → 無限スクロール化
- `viewer-incremental-list-footer` / 残り件数表示 `<p>` の削除
- スクロール末尾検出には `IntersectionObserver` を使う（sentinel 要素方式）
- ロード中インジケーターは任意（シンプルで可）

## Out Of Scope

- `settings-tag-management-panel.tsx` / `settings-tag-redirects-panel.tsx` の「さらに表示」は変更しない
- `viewer-app.tsx` の `loadMoreTagOptions` / `loadMoreUserOptions` の prop 削除は不要（settings パネルが引き続き使う可能性がある場合は残す。使わないなら削除可）
- DB スキーマ・repository 層の変更
- 仮想スクロール導入

## Constraints

- `useIncrementalList` フックの `loadMore()` を再利用する
- モーダル内の既存スクロールコンテナ（`overflow-y: auto` な要素）を sentinel の親とする
- 選択中フィルターが初期表示外に落ちない挙動（`requiredCount` 利用）は維持する
- `npm run typecheck` と `npm run build` を通す

## Files To Read First

- `src/features/viewer/components/unified-filter-modal.tsx` — ユーザー/タグパネルの現状実装（行 300–510 付近）
- `src/features/viewer/components/use-incremental-list.ts` — `loadMore()` の実装
- `src/entrypoints/viewer/style.css` — `viewer-incremental-list-footer` 等の既存スタイル

## Inputs From Claude

- 現在の「さらに表示」は `unified-filter-modal.tsx` の `UserFilterPanel`（行 363–374）と `TagFilterPanel`（行 494–505）にある
- `useIncrementalList` の `hasMore` / `loadMore` が既に存在する
- 無限スクロールは `IntersectionObserver` + sentinel 要素（リスト末尾に置く `<div ref={sentinelRef}>`）で実装するのが最小コスト
- `viewer-app.tsx` は `onLoadMoreTags` / `onLoadMoreUsers` を `unified-filter-modal` に渡しているが、無限スクロール化後は modal 内部で完結するため prop を削除できる

## Acceptance Criteria

- ユーザーフィルターパネルで「さらに表示」ボタンが表示されない
- タグフィルターパネルで「さらに表示」ボタンが表示されない
- 各パネルのリストを末尾までスクロールすると自動で続きが読み込まれる
- 選択中フィルターが初期表示件数の外にある場合も表示が欠けない
- `npm run typecheck`
- `npm run build`

## Open Questions

- `onLoadMoreTags` / `onLoadMoreUsers` prop が modal 内部のみで使われている場合は削除してよい。`viewer-app.tsx` でも直接参照していないか確認すること

## Work Log

- `2026-04-20 Claude`: task packet 作成

## Codex Plan

## Codex Result

## Changed Files

## Verification

## Remaining Issues

## Suggested Next Action

## Completion Checklist
- [ ] implementation finished
- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] task packet `Codex Result` updated
- [ ] task packet `Verification` updated
- [ ] `ai-handoff/current-task.md` updated
- [ ] `npm run handoff:check`
