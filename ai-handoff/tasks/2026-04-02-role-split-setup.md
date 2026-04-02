# Task Packet

## Goal
Claude と Codex の役割分担、handoff の置き場所、受け渡しテンプレートをこのリポジトリの標準運用として定義する。

## Requested Action
- `AGENTS.md` に AI 協業ルールを追加する
- `ai-handoff/` の構成を整理する
- 今後使うテンプレートを用意する
- 必要なら `ai-handoff/current-task.md` を整理する

## In Scope
- AI 間の役割分担の明文化
- handoff 用ディレクトリ構成の整備
- `current-task.md` のダッシュボード化
- 再利用できるテンプレートの作成

## Out Of Scope
- Chrome / X 側の追加調査
- プロダクト機能の実装
- `docs/` 配下の既存仕様文書の全面改稿

## Constraints
- Chrome / X 側の広い探索は Codex の主担当にしない
- 実装・レビュー・Git 作業はできるだけ Codex に寄せる
- 毎回の指示を減らせる形で文書化する

## Files To Read First
- `AGENTS.md`
- `ai-handoff/current-task.md`
- `docs/likes-import-handover-2026-04-01.md`

## Inputs From Claude
- 既存の `current-task.md` に役割分担と制約が整理されている
- 調査ログはそのまま渡さず、圧縮した結論だけを使う

## Acceptance Criteria
- `AGENTS.md` に Claude / Codex の役割分担と handoff ルールが追加されている
- `ai-handoff/` 配下に README とテンプレートがあり、次回から再利用できる
- `current-task.md` がダッシュボードとして機能する形になっている
- 次のタスク開始時に迷わない最低限の運用ルールが文書化されている

## Open Questions
- 同時に複数タスクを並行させるかどうかは未定。現時点では 1 active task 前提とする
- 完了済み task packet をいつ `archive/` に移すかは、運用しながら調整する

## Codex Plan
- `AGENTS.md` に `AI Collaboration Rules` と `AI Handoff Files` を追加する
- `ai-handoff/README.md` で役割と保存先の境界を固定する
- `templates/` に 3 種類のテンプレートを追加する
- `current-task.md` を短いダッシュボードへ置き換える
- このタスク自体の packet を `tasks/` に残す

## Codex Result
- `AGENTS.md` に Claude / Codex の役割分担、圧縮 handoff、`ai-handoff/` の責務を追加した
- `ai-handoff/README.md` を追加し、`current-task.md` / `tasks/` / `findings/` / `templates/` / `archive/` の使い分けを明文化した
- `ai-handoff/current-task.md` をダッシュボード形式へ更新した
- `ai-handoff/templates/` に `current-task`、`task-packet`、`finding-note` のテンプレートを追加した
- `ai-handoff/findings/README.md` と `ai-handoff/archive/README.md` を追加して、空ディレクトリでも用途が分かる状態にした

## Changed Files
- `AGENTS.md`
- `ai-handoff/README.md`
- `ai-handoff/current-task.md`
- `ai-handoff/tasks/2026-04-02-role-split-setup.md`
- `ai-handoff/templates/current-task.template.md`
- `ai-handoff/templates/task-packet.template.md`
- `ai-handoff/templates/finding-note.template.md`
- `ai-handoff/findings/README.md`
- `ai-handoff/archive/README.md`

## Verification
- 追加した文書同士で責務の線引きが矛盾しないことを目視確認
- `current-task.md` から active task を辿れる構成になっていることを確認

## Remaining Issues
- 1 active task 前提のため、将来並列作業が増えた場合は運用ルールの追加が必要
- archive の回し方はまだ手動運用

## Suggested Next Action
- 次の実タスク開始時に `templates/task-packet.template.md` を複製して運用を試す
- 運用で詰まる点が出たら `AGENTS.md` ではなく、まず `ai-handoff/README.md` とテンプレートを小さく調整する
