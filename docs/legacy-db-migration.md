# Legacy DB Migration

## Purpose

この手順は一度だけ使う旧 DB 退避・移行用です。
本体コードには組み込まず、必要なときだけ手動で実行します。

対象:

- legacy DB: `x-post-archive`
- current DB: `x-post-archive-posts-v1`
- backup DB: `x-post-archive-backup-v1`

## What The Script Does

[scripts/migrate-legacy-posts.js](../scripts/migrate-legacy-posts.js) は次を実行します。

1. 旧 DB `x-post-archive` を読む
2. raw backup を `x-post-archive-backup-v1` に保存する
3. 復元可能な `posts` レコードを現行形式へ変換する
4. `x-post-archive-posts-v1` を作り直す
5. 変換済み投稿を新 DB に投入する

## How To Run

1. Chrome で unpacked extension を読み込む
2. 拡張の viewer ページを開く
3. viewer ページの DevTools を開く
4. [scripts/migrate-legacy-posts.js](../scripts/migrate-legacy-posts.js) の内容を console に貼り付けて実行する
5. 完了ログを確認する

## Notes

- このスクリプトは単発実行前提
- 変換できない raw データも backup DB 側には残る
- 通常運用では実行しない
