# Task Packet: 重複自動停止の上限を 999 件に増加

## Meta
- status: active
- owner: Codex
- branch: master
- priority: normal
- files_in_scope: src/types/archive.ts
- blocked_by: none
- related_findings: none
- needs_from_claude: none
- handoff_to_codex: src/types/archive.ts の定数を変更するだけ。下記参照
- summary:

## Goal

likes / bookmarks / timeline の一括取り込みで重複連続バッチによる自動停止の上限設定値を 20 → 999 に増やし、大量アーカイブ取得時の途中停止を防ぐ。

## Problem Statement

`src/types/archive.ts` の `MAX_BULK_IMPORT_DUPLICATE_BATCH_THRESHOLD = 20` が上限として機能している。設定 UI (`settings-basic-panel.tsx`) の `<input type="number" max={MAX_BULK_IMPORT_DUPLICATE_BATCH_THRESHOLD}>` と、`archive-settings.ts` のクランプ処理も同じ定数を参照しているため、定数を変えるだけで UI・バリデーション・クランプがすべて追従する。

## Requested Action

`src/types/archive.ts` の以下の行を変更する:

```typescript
// 変更前
export const MAX_BULK_IMPORT_DUPLICATE_BATCH_THRESHOLD = 20;

// 変更後
export const MAX_BULK_IMPORT_DUPLICATE_BATCH_THRESHOLD = 999;
```

それ以外のファイルは変更不要（`settings-basic-panel.tsx` と `archive-settings.ts` はすでに定数参照）。

## In Scope

- `src/types/archive.ts` — `MAX_BULK_IMPORT_DUPLICATE_BATCH_THRESHOLD` の値変更のみ

## Out Of Scope

- デフォルト値 (`DEFAULT_BULK_IMPORT_DUPLICATE_BATCH_THRESHOLD = 3`) の変更
- 最小値 (`MIN_BULK_IMPORT_DUPLICATE_BATCH_THRESHOLD = 1`) の変更
- `timeline-import-controls.ts` の停止ロジック変更

## Constraints

- 定数値以外の変更を加えない

## Files To Read First

- `src/types/archive.ts`（変更前の定数値を確認）

## Acceptance Criteria

- [ ] `MAX_BULK_IMPORT_DUPLICATE_BATCH_THRESHOLD` が 999 になっている
- [ ] 設定 UI の数値入力で 999 まで入力できる
- [ ] `npm run typecheck` pass
- [ ] `npm run build` pass

## Open Questions

なし

## Work Log

- `2026-04-18 Claude`: task packet 作成。変更箇所は src/types/archive.ts の定数 1 か所のみ

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
- [ ] task packet `Codex Result` or `Result` updated
- [ ] task packet `Verification` updated
- [ ] `ai-handoff/current-task.md` updated
- [ ] `npm run handoff:check`
