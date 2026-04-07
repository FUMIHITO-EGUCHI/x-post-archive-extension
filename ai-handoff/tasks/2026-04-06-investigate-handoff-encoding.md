# Task Packet

- GitHub Issue: `#3`

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

- `ai-handoff/` 配下の Markdown 自体は壊れておらず、UTF-8 の日本語テキストとして保存されていることを確認した。
- 主因は Windows PowerShell の `Get-Content` 既定読込で、UTF-8 no-BOM の handoff Markdown を ANSI として誤読し、CLI 上で文字化けさせていたこと。
- 追加で、この環境では Node 標準出力へ日本語を流すと `?` に潰れる経路も再現した。CLI 引数や stdout 経由で日本語本文を別コマンドへ渡すのは危険。
- findings は `ai-handoff/findings/2026-04-07-handoff-encoding.md` に整理した。

## Changed Files

- `ai-handoff/README.md`
- `ai-handoff/current-task.md`
- `ai-handoff/findings/2026-04-07-handoff-encoding.md`

## Verification

- `Format-Hex -Path ai-handoff\\tasks\\2026-04-04-user-filter.md`
- `Get-Content ai-handoff\\tasks\\2026-04-04-user-filter.md`
- `Get-Content ai-handoff\\tasks\\2026-04-04-user-filter.md -Encoding utf8`
- `[System.Text.Encoding]::UTF8.GetString([System.IO.File]::ReadAllBytes(...))`
- `Write-Output '日本語テスト こんにちは 文字化け調査'`
- Node 経由の日本語 stdout テスト

## Remaining Issues

- GitHub Issue 作成や更新の日本語経路は安全運用が分かったが、専用ヘルパー化はまだしていない。
- Claude / Codex の会話本文そのものに文字化けが混入する追加経路があるかは、今後再発時に継続観測が必要。

## Suggested Next Action

- `ai-handoff/README.md` の運用ルールに従い、handoff Markdown は `Get-Content -Encoding utf8` で読む。
- GitHub 連携やスクリプト生成で日本語本文を扱うときは、UTF-8 ファイルまたは JSON body 経由へ寄せる。
