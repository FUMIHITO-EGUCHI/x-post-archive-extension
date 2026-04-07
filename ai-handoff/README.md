# AI Handoff

`ai-handoff/` は Claude と Codex の短期的な受け渡し用ディレクトリです。
ここには「今の作業を次に渡すための最小限の文脈」を置き、長期的に残す仕様や設計判断は `docs/` に残します。

## Structure
- `current-task.md`
  - いま何をやっているかを 1 ファイルで示すダッシュボード
  - 常に 1 件のアクティブタスクだけを指す
- `tasks/`
  - 1 タスク 1 ファイルの task packet
  - Claude から Codex への依頼内容と、Codex の結果を同じファイルに残す
- `findings/`
  - 調査結果の圧縮ノート
  - 生ログではなく、結論・根拠・未解決点だけを書く
- `templates/`
  - `current-task.md` と task packet と finding note の雛形
- `archive/`
  - 完了済みの handoff ファイル退避先

## Workflow
1. task packet がまだない、または読むべき技術ファイルが決まっていない場合は `docs/tech-index.md` から入る。
2. 調査が先行したら `findings/` に圧縮済みノートを作る。
3. 作業依頼を出す前に `templates/task-packet.template.md` から `tasks/` に task packet を作る。
4. `current-task.md` から、その task packet と関連 findings を参照できるようにする。
5. Codex は作業後に task packet の結果欄を埋め、`current-task.md` の状態を更新する。
6. 役目を終えた packet や findings は `archive/` に移す。

## Boundary With docs
- `ai-handoff/`:
  - 今回の作業の依頼
  - 圧縮した調査結果
  - 実装後の残課題
- `docs/`:
  - 要件
  - MVP 定義
  - データモデル
  - 技術索引 (`docs/tech-index.md`)
  - 長く残す実装方針
  - 将来の参照価値が高い handover

## Writing Rules
- 生ログをそのまま貼らない
- scope と non-scope を必ず切る
- 読むべきファイルを先頭で示す
- acceptance criteria を書いてから実装を渡す
- 結論のない調査メモを増やさない
- Windows PowerShell で handoff Markdown を読むときは `Get-Content -Encoding utf8` を明示する
- 日本語本文を CLI 引数や標準出力で別コマンドへ渡す運用は避け、UTF-8 ファイルか JSON body を優先する
