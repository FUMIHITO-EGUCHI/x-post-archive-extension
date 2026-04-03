# Task Packet

## Goal

Codex が入れた backup/restore 安全化と `quoted_post_id` 復元修正を、Claude がブラウザ上で手動確認できる状態にする。

## Requested Action

Chrome 上で archive backup/restore の手動確認を行い、復元失敗時の既存データ保全と、通常 restore 成功時の archive 置換挙動を確認する。

## In Scope

- settings 画面からの backup/restore 手動確認
- restore 失敗時に既存 archive が消えないことの確認
- restore 成功時に archive が置き換わることの確認
- restore 後に viewer 一覧が成立することの確認
- `quoted_post_id` を含む backup manifest が restore で落ちないことの確認

## Out Of Scope

- `git push`
- 自動テスト追加
- quoted-post viewer UI 実装
- X DOM の広い再調査

## Constraints

- このブランチは `fix/archive-review-findings`
- Codex 側では `npm run typecheck` と `npm run build` は通過済み
- 現在のブランチには quoted-post 抽出の `history.pushState` / `click()` fallback 実装自体が存在しない
- quoted-post 関連のブラウザ確認を行う場合は「保存済み backup manifest の round-trip 確認」に限定する

## Files To Read First

- `src/features/archive/archive-maintenance-service.ts`
- `src/types/archive.ts`
- `src/types/archive-backup.ts`
- `ai-handoff/findings/2026-04-02-restore-validation-context.md`

## Inputs From Claude

- なし。Codex からの引き継ぎのみ。

## Acceptance Criteria

- [ ] 正常系 restore で archive が viewer 上で復元される
- [ ] restore 後に post / media / tags の基本件数が大きく崩れていない
- [ ] restore 途中失敗を意図的に起こした場合でも、元の archive が消えない
- [ ] `quoted_post_id` を含む manifest で restore が通る、または現状 UI 上で見えないなら少なくともデータ破損を起こさない
- [ ] Claude が手動確認結果を findings か task packet result に残す

## Open Questions

- UI 側に quoted post 表示はまだ存在しないため、`quoted_post_id` の確認は DB / exported manifest ベースで行うかもしれない
- restore 失敗ケースは「壊した ZIP」「manifest 不整合 ZIP」「途中キャンセル」など、どのパターンが最も再現しやすいかを Claude 側で判断してよい

## Codex Plan

- backup/restore の破壊的フローを先に修正する
- restore で `quoted_post_id` が落ちる不整合を直す
- Claude がすぐに確認できるように task packet を更新する

## Codex Result

- restore は既存 archive を先に削除せず、backup 内ファイルを一意な staging OPFS path に展開してから DB を入れ替える方式に変更した
- restore 途中失敗時は staging 側だけ best-effort で掃除し、既存 archive は保持する構造にした
- backup import 時に `quoted_post_id` を復元するよう修正した
- 現在のブランチには quoted-post 抽出の `history.pushState` 依存コードは存在しないことを確認した

## Changed Files

- `src/features/archive/archive-maintenance-service.ts`
- `src/types/archive.ts`
- `src/types/archive-backup.ts`
- `src/features/settings/archive-language.ts`
- `ai-handoff/current-task.md`
- `ai-handoff/tasks/2026-04-02-restore-manual-validation.md`
- `ai-handoff/findings/2026-04-02-restore-validation-context.md`

## Verification

- `npm run typecheck`
- `npm run build`

## Remaining Issues

- quoted-post viewer 表示は未実装
- quoted-post 保存フロー自体はこのブランチで未接続なので、`history.pushState` 依存の除去確認は「該当コードなし」として扱うしかない
- backup/restore の挙動はまだブラウザ手動確認が未実施

## Suggested Next Action

- Claude が Chrome で backup/restore を手動検証し、失敗系で既存 archive が残るかを最優先で確認する
