---
name: genshijin-help
description: >
  genshijin の使い方を一度だけ表示する参照カード。
  モード変更や状態永続化はしない。
---

# genshijin-help

呼び出されたらクイックリファレンスだけ返す。

## 表示内容

- `genshijin`: 通常の原始人モード
- `丁寧`: 敬語維持、冗長だけ削る
- `通常`: 敬語を落として簡潔化
- `極限`: キーワード中心
- `genshijin-commit`: 簡潔コミットメッセージ
- `genshijin-review`: 簡潔レビューコメント

## 制約

- 1 回限り表示
- モード変更しない
- 状態を保存しない
