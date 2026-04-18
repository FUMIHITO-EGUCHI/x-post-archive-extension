# Task Packet: タグ付けが遅い — パフォーマンス改善

## Meta
- status: done
- owner: Codex
- branch: master
- priority: high
- files_in_scope: src/features/viewer/components/use-tag-operations.ts, src/features/viewer/components/viewer-app.tsx
- blocked_by: none
- related_findings: none
- needs_from_claude: 原因特定（下記 Problem Statement 参照）
- handoff_to_codex: 原因特定後に設計を追記する
- summary:

## Goal

タグ追加・削除の体感レスポンスを改善する。操作後の UI 更新が遅いと報告されている。

## Problem Statement

`use-tag-operations.ts` の `handleAddTagToPost` / `handleRemoveTagFromPost` は以下の順序で動く:

1. `requestAddPostTagByName(xPostId, displayName)` — background IPC でタグを DB に追加
2. `await reloadCurrentArchive()` — 現在のフィルタ・ソート条件でポスト一覧を全件再クエリ

(2) が遅い主因と考えられる。`reloadCurrentArchive` は `loadArchivePage` (use-archive-loader.ts) を呼び出し、background に `requestPostsPage` を送り、DB クエリ → IPC 往復 → React state 更新 → 再描画 という全サイクルを経る。

ポスト件数が多いほど顕著に遅くなる。タグ操作は 1 投稿の `post_tags` だけを変えるが、全件再ロードが発生している。

## Requested Action

1. `viewer-app.tsx` で `reloadCurrentArchive` がどう定義・渡されているかを確認する
2. タグ操作後の更新を「全件再ロード」から「該当投稿のタグだけ楽観的に更新」に変える方法を検討する
3. 楽観的更新が難しければ、`reloadCurrentArchive` のスコープを「影響投稿の再フェッチのみ」に絞る方法を検討する

## In Scope

- `src/features/viewer/components/use-tag-operations.ts`
- `src/features/viewer/components/viewer-app.tsx`（`reloadCurrentArchive` の定義箇所）
- タグ操作後の state 更新パス

## Out Of Scope

- タグ一覧画面 (`settings-tag-management-panel.tsx`) のパフォーマンス
- bulk-tag-modal のパフォーマンス
- DB スキーマ変更

## Constraints

- React state の更新は hooks のトップレベルルールを守ること
- 表示内容（タグの付き外れ）が実際の DB 状態と一致していること — 楽観的更新でズレが生じる場合はロールバック処理を追加する
- background との IPC 構造（`requestAddPostTagByName` の返り値）を確認してから設計すること

## Files To Read First

- `src/features/viewer/components/use-tag-operations.ts`
- `src/features/viewer/components/viewer-app.tsx`（`reloadCurrentArchive` の定義と引数）
- `src/features/viewer/components/use-archive-loader.ts`
- `src/features/runtime/client.ts`（`requestAddPostTagByName` の返り値型）

## Acceptance Criteria

- [ ] タグ追加・削除後の UI 更新が全件再ロードなしに（または大幅に絞られた範囲で）完了する
- [ ] タグ表示が DB 状態と一致している（楽観的更新後にズレがない、またはロールバックされる）
- [ ] `npm run typecheck` pass
- [ ] `npm run build` pass

## Open Questions

- `requestAddPostTagByName` は追加後のタグリストを返すか？返す場合は楽観的更新の素材になる
- `reloadCurrentArchive` は viewer-app.tsx でどう定義されているか（loadArchivePage のラッパーか）

## Work Log

- `2026-04-18 Claude`: task packet 作成。原因を reloadCurrentArchive の全件再ロードと特定。設計は Codex に委ねる

## Codex Plan
- `reloadCurrentArchive` の呼び出し箇所を確認する。
- タグ追加は runtime が返す `postTag` を使い、表示中投稿の `tags` だけ局所更新する。
- タグ削除は表示中投稿の `tags` から対象を外し、現在のタグフィルタを外す操作なら表示中リストから投稿を外す。
- タグサマリー更新は `refreshArchiveMetadata` のみに絞る。
- `npm run typecheck` と `npm run build` で確認する。

## Codex Result
タグ追加・削除後の全件再ロードをやめ、表示中投稿のタグ配列を React state 上で局所更新するようにした。タグフィルタ中にそのタグを削除した場合は、DB 状態と表示条件を合わせるため該当投稿を現在ページから外す。タグ一覧や件数は `refreshArchiveMetadata` で更新する。

## Changed Files
- `src/features/viewer/components/use-tag-operations.ts`
- `src/features/viewer/components/use-archive-loader.ts`
- `src/features/viewer/components/viewer-app.tsx`

## Verification
- `npm run typecheck` passed
- `npm run build` passed

## Remaining Issues
none

## Suggested Next Action
Manual verify in the viewer with a large filtered list: add/remove a manual tag and confirm the list is not fully reloaded.

## Completion Checklist
- [x] implementation finished
- [x] `npm run typecheck`
- [x] `npm run build`
- [x] task packet `Codex Result` or `Result` updated
- [x] task packet `Verification` updated
- [x] `ai-handoff/current-task.md` updated
- [x] `npm run handoff:check`
