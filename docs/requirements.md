# Requirements

## Goal

X の各投稿を保存し、あとから本文と画像を見返せる Chrome 拡張を作る。
検索性を優先するため、本文や投稿者などの検索対象は構造化データとして保持し、画像バイナリは OPFS に保存する。

## Current Target

今回の拡張で実現したいこと:

1. 投稿本文に加えて画像も保存できる
2. viewer で保存済み画像を表示できる
3. 本文検索と画像表示を両立できるデータ構造にする
4. 画像本体は IndexedDB ではなく OPFS に置く

今回まだ実装しないこと:

- 動画保存
- 画像の再圧縮や変換
- 会話全体保存
- 保存済み画像の自動更新
- 複数投稿間の画像重複排除
- 高度なバックアップ / エクスポート

## Saved Fields

### Post snapshot

- `x_post_id`
- `x_username`
- `post_text`
- `post_url`
- `saved_at`

### Image metadata

- `media_id`
- `x_post_id`
- `source_url`
- `media_type`
- `position`
- `alt_text`
- `width`
- `height`
- `opfs_path`
- `mime_type`
- `byte_size`
- `storage_status`
- `last_error`
- `saved_at`

## DOM Extraction Policy

- CSS クラス名には依存しない
- 投稿本文は `article[data-testid="tweet"]` 単位で扱う
- permalink から `x_username`, `x_post_id`, `post_url` を取る
- 本文は `data-testid="tweetText"` を優先して取る
- 画像は投稿本文領域に含まれる `img` から抽出する
- アバター、絵文字、プロフィール画像、通知用画像は除外する
- 画像 URL は表示用の一時 URL ではなく、保存用に安定した URL を採用する

## Responsibility Split

以下は明確に分離する。

1. 投稿 DOM 検出
2. 投稿本文と画像メタデータの抽出
3. 保存ボタン差し込み
4. background での保存要求受付
5. IndexedDB への投稿 / 画像メタデータ保存
6. OPFS への画像バイナリ保存
7. viewer での一覧 / 詳細表示
8. 削除時の IndexedDB / OPFS 整合

## Runtime Direction

- Manifest V3
- WXT
- TypeScript strict
- React は viewer のみ
- content script と background は素の TypeScript
- 保存処理は content script から background へ message で依頼する
- 画像バイナリ保存は extension origin 側で行う

## Storage Direction

- 検索や一覧に必要なメタデータは IndexedDB
- 画像本体は OPFS
- `chrome.storage.local` は設定や一時フラグに限定する
- 画像表示時は OPFS から `Blob` を読み出して object URL 化する

## Constraints

- 保存済み投稿はスナップショットとして扱う
- 画像のみ投稿を保存できるよう、`post_text` は空文字の可能性を許容する
- 保存後に本文や画像 URL を自動追従しない
- 画像保存失敗時は投稿保存全体の扱いを明確にする
- 削除時に孤立ファイルを残しにくい構造にする
- viewer は X の見た目再現より、読みやすさと見つけやすさを優先する
