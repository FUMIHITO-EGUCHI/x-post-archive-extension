# Task Packet

## Goal

Codex / Claude 間の handoff 文書や確認ログで発生している文字化けの原因を特定し、再発防止のための対策方針を明確にする。

## Requested Action

調査・原因整理・対策案の提示まで行う。必要なら軽微な修正案を提案するが、広範囲な運用変更は別タスク化する。

## In Scope

- `ai-handoff/` 配下の Markdown ファイルで発生している文字化けの再現条件整理
- PowerShell / `Get-Content` / Git / 端末コードページ / UTF-8 BOM 有無など、表示系の要因切り分け
- 実ファイルが壊れているのか、表示時のみ文字化けしているのかの判定
- Claude → Codex handoff で文字化けが起きやすい経路の特定
- findings への記録と、必要なら運用ルールへの反映提案

## Out Of Scope

- handoff フロー全体の再設計
- 既存の全 Markdown ファイル一括変換
- エディタ固有設定の強制
- push

## Constraints

- まず原因調査を優先し、推測で全面修正しない
- 実ファイル内容と CLI 表示結果を分けて扱う
- 長期的なルール変更が必要なら `docs/` または `AGENTS.md` 反映案を明示する

## Files To Read First

- `ai-handoff/README.md`
- `ai-handoff/current-task.md`
- `ai-handoff/tasks/2026-04-04-bookmarks-import.md`
- `AGENTS.md`

## Inputs From Claude

- Codex / Claude 間のやり取りで文字化けが確認されている
- handoff 系 Markdown を CLI で確認した際に日本語が崩れて見えるケースがある
- 原因がファイル破損なのか表示系なのか未確定

## Acceptance Criteria

- 文字化けの再現条件または非再現条件が整理されている
- 原因候補が優先度付きで整理されている
- 実ファイル破損か表示時の問題かが判定されている
- 必要な対策案と影響範囲が明示されている
- 調査結果が `ai-handoff/findings/` に残せる粒度でまとまっている

## Open Questions

- 問題は PowerShell 上の表示だけか、Claude / Codex の受け渡し本文にも入っているか
- UTF-8 BOM の有無を handoff ファイル群で統一すべきか
- `Get-Content` 以外の確認手順を標準運用にすべきか

## Codex Plan

- 再現経路を整理する
- ファイルエンコーディングと表示経路を切り分ける
- 原因候補を絞る
- findings と運用提案をまとめる

## Codex Result

<!-- 完了後に記入 -->

## Changed Files

<!-- 完了後に記入 -->

## Verification

<!-- 完了後に記入 -->

## Remaining Issues

<!-- 完了後に記入 -->

## Suggested Next Action

<!-- 完了後に記入 -->
