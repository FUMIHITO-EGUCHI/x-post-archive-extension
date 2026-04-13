# Current Task

## Active

- `2026-04-13-sticky-toolbar-and-unified-filter`: スティッキーツールバー導入 & ユーザー/タグ/日付フィルターを単一タブ式モーダルに統合。チップ溢れ時 +N 表示対応
- task_file: `ai-handoff/tasks/2026-04-13-sticky-toolbar-and-unified-filter.md`

## Scope

- files_in_scope: `src/features/viewer/components/viewer-app.tsx`, `src/features/viewer/components/sticky-toolbar.tsx`, `src/features/viewer/components/unified-filter-modal.tsx`, `src/entrypoints/viewer/style.css`
- out_of_scope: 設定画面の変更
- out_of_scope: content script / background の変更
- out_of_scope: セッション復元ロジックの変更
- out_of_scope: push

## Coordination

- blocked_by: `none`
- related_findings: `none`
- needs_from_claude: `none`
- handoff_to_codex: 要件定義・設計済み。スティッキーバーと統合フィルターモーダルを実装する

## Next Action

- next_action: Codex が `feature/sticky-toolbar-unified-filter` ブランチで実装する

## Acceptance Criteria

- スクロール時にツールバーが画面上部に固定されたままになる
- 「絞り込み」ボタン 1 つで統合フィルターモーダルが開く
- モーダル内のユーザー / タグ / 日付タブが切り替えられる
- アクティブなフィルターが存在するタブにバッジが表示される
- フィルター適用中、ツールバー中央にチップが表示される
- フィルターが 3 個全て適用中は `+3 件の絞り込み中` にまとまる
- `+N` ボタンクリックで統合モーダルが開き、最初のアクティブタブが選択されている
- 各チップの × ボタンで個別にフィルターが解除される
- 件数表示がツールバー右端に表示される
- 一括タグ付けボタンがツールバーに収まっている
- `npm run typecheck` passes
- `npm run build` passes

## Completion Checklist

- [ ] StickyToolbar コンポーネント作成
- [ ] UnifiedFilterModal コンポーネント作成（3タブ統合）
- [ ] viewer-app.tsx: フィルターモーダル State 統合
- [ ] viewer-app.tsx: viewer-hero / viewer-list-header を StickyToolbar に置き換え
- [ ] style.css: sticky バー・チップ・タブ CSS 追加
- [ ] ダークモード確認
- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] task packet `Codex Result` updated
- [ ] task packet `Verification` updated
- [ ] `ai-handoff/current-task.md` updated
- [ ] `npm run handoff:check`

## Recent Updates

- `2026-04-13 Claude`: スティッキーツールバー & 統合フィルターモーダルの要件定義・設計完了、タスクパケット作成

## Waiting Tasks

- `none`

## Recently Completed

- `2026-04-13-viewer-list-ux-improvements`: viewer list P1/P2 UX fixes completed; optional P3 toolbar merge and image pending skeleton also implemented
- `2026-04-11-fix-review-v0-17-1-followups`: implemented all v0.17.1 follow-up fixes including Finding 22 (viewer archive maintenance routed through background runtime); all 22 findings resolved
- `2026-04-10-investigate-bulk-import-duplicate-images`: duplicate image persistence was fixed by canonical Twitter image URL identity, existing duplicate cleanup was verified, the temporary cleanup hook is dev-only, and a fresh bookmarks bulk import produced duplicate-save logs with no new media rows
- `2026-04-10-investigate-bulk-import-missing-posts`: bulk import missing-post loss was fixed by bounded incremental timeline scrolling plus final stop-after-scroll collection, and the target likes post was confirmed saved in real-device verification
- `2026-04-10-investigate-quoted-nesting-display`: quoted nesting now backfills `quoted_post_id` during duplicate save and refetch, with shared-profile runtime and viewer DOM verification
