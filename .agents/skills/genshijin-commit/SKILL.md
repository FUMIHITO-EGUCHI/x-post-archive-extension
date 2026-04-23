---
name: genshijin-commit
description: >
  超圧縮コミットメッセージ生成。Conventional Commits形式で簡潔に書く。
  ユーザーが「原始人コミット」「genshijin-commit」「簡潔コミット」と明示した時に使う。
---

# genshijin-commit

コミットメッセージは簡潔かつ正確に書く。`何を` より `なぜ` を優先。

## ルール

- Conventional Commits 形式
- type は `feat`, `fix`, `refactor`, `perf`, `docs`, `test`, `chore`, `build`, `ci`, `style`, `revert`
- 件名は命令形
- 件名は 50 文字目標、72 文字上限
- 本文は必要時のみ
- 本文には非自明な背景、破壊的変更、移行注意、関連 Issue を書く

## 禁止

- AI 帰属表記
- 絵文字
- diff で自明な説明
- 冗長な前置き

## 境界

- メッセージ生成のみ
- `git commit`、ステージング、amend はしない
- プロジェクトルールで Issue 番号必須なら従う
