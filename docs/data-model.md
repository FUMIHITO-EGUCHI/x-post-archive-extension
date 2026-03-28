# Data Model

## Scope

初版では 1 投稿単位の保存だけを扱う。
タグ、スレッド、メディア、反応数、ユーザー集計はデータモデルに含めない。

## Store

### `posts`

IndexedDB のストア名は `posts` とする。
主キーは `x_post_id` をそのまま使う。

フィールド:

- `x_post_id: string`
- `x_username: string`
- `post_text: string`
- `post_url: string`
- `saved_at: number`

## Constraints

以下は必須項目とする。

- `x_post_id`
- `x_username`
- `post_text`
- `post_url`
- `saved_at`

バリデーション方針:

- `string` 項目は `null` / `undefined` だけでなく空文字も不可
- `saved_at` はミリ秒 timestamp の有限な数値
- `x_post_id` が重複する場合は新規保存しない

## Index Design

初版の一覧要件は `saved_at` 降順のみなので、少なくとも以下を持つ。

- primary key: `x_post_id`
- secondary index: `saved_at`

Dexie の schema は `posts: "&x_post_id, saved_at"` とする。

## Display Model

初版では保存データと表示データの差分が小さいため、viewer は `posts` をそのまま読む。
将来検索や集計を追加するときは、viewer 用 selector / mapper を追加して分離する。
