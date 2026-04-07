# Finding Note

## Topic

Codex / Claude handoff 文字化けの調査

## Question

`ai-handoff/` 配下の Markdown や GitHub Issue 作成時に見えていた日本語の文字化けは、ファイル自体の破損なのか、それとも Windows CLI の表示経路でだけ発生しているのか。

## Conclusion

- handoff Markdown ファイル自体は破損していない。少なくとも `ai-handoff/tasks/2026-04-04-user-filter.md` は UTF-8 の日本語バイト列で保存されている。
- 主因の 1 つは Windows PowerShell の `Get-Content` 既定読込で、UTF-8 no-BOM の Markdown を ANSI として解釈し、日本語が文字化けすること。
- 別経路として、Node を使って日本語をそのまま標準出力へ流すと、この環境では `?` に潰れる再現がある。CLI 引数や標準出力を経由して日本語を外部コマンドへ渡す運用は安全ではない。
- したがって、今回の文字化けは「ファイル破損」ではなく「読み出し / 表示経路のエンコーディング不一致」が主因と判断してよい。

## Confidence

高い

## Evidence

- `Format-Hex -Path ai-handoff\\tasks\\2026-04-04-user-filter.md` で先頭バイトを確認すると、日本語部分は UTF-8 として妥当なバイト列になっていた。
- `Get-Content ai-handoff\\tasks\\2026-04-04-user-filter.md` は文字化けした。
- `Get-Content ai-handoff\\tasks\\2026-04-04-user-filter.md -Encoding utf8` では同じファイルが正常に読めた。
- `[System.Text.Encoding]::UTF8.GetString([System.IO.File]::ReadAllBytes(...))` でも正常に復元できた。
- `Write-Output '日本語テスト こんにちは 文字化け調査'` は正常表示だった。
- `node -e "console.log('日本語テスト こんにちは 文字化け調査')"` 相当の実行では `?????? ????? ??????` となり、日本語が stdout 経路で失われた。

## Rejected Hypotheses

- handoff Markdown が既に壊れた文字列で保存されている
- Git の checkout / repository storage だけで日本語が破損している
- PowerShell の日本語表示は常に壊れており、単純な日本語出力も不可能

## Suggested Action For Codex

- handoff Markdown を CLI で読むときは `Get-Content -Encoding utf8` を明示する。
- 日本語を含む本文を外部コマンドや API に渡すときは、CLI 引数や標準出力ではなく UTF-8 ファイルか JSON body を経由する。
- GitHub Issue 作成や更新も、可能なら今回と同じく UTF-8 ファイルを読んで REST API へ送る。
