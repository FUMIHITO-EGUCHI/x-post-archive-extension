# Data Model

## Scope

本文検索を維持しつつ画像も保存するため、保存対象を次の 2 層に分ける。

- IndexedDB: 投稿と画像メタデータ
- OPFS: 画像バイナリ本体

この段階では動画、スレッド、タグ、反応数は含めない。

## Stores

### `posts`

主キーは `x_post_id` をそのまま使う。

フィールド:

- `x_post_id: string`
- `x_username: string`
- `post_text: string`
- `post_url: string`
- `saved_at: number`

### `media`

画像メタデータを保持する。
1 投稿に複数画像がある前提で、1 画像 1 レコードにする。

フィールド:

- `media_id: string`
- `x_post_id: string`
- `media_type: "image"`
- `source_url: string`
- `opfs_path: string`
- `position: number`
- `alt_text: string | null`
- `width: number | null`
- `height: number | null`
- `mime_type: string | null`
- `byte_size: number | null`
- `storage_status: "pending" | "ready" | "failed"`
- `saved_at: number`
- `last_error: string | null`

## Key Design

### `posts`

- primary key: `x_post_id`
- secondary index: `saved_at`

### `media`

- primary key: `media_id`
- secondary index: `x_post_id`
- secondary index: `[x_post_id+position]`
- secondary index: `storage_status`
- secondary index: `saved_at`

Dexie schema の初期案:

```ts
posts: "&x_post_id, saved_at"
media: "&media_id, x_post_id, [x_post_id+position], storage_status, saved_at"
```

## Record Relationship

- `posts` 1 件に対して `media` は 0..n 件
- viewer の表示単位は投稿だが、保存単位として画像は独立レコードにする
- 将来動画や引用画像を扱う場合も `media_type` を拡張して吸収できる形にする

## OPFS Layout

OPFS 上の配置は extension origin 配下で論理ディレクトリを切る。

例:

```text
/media/images/{x_post_id}/{media_id}.bin
```

方針:

- `x_post_id` 単位のディレクトリにまとめる
- ファイル名は表示 URL ではなく `media_id` ベースにする
- 表示時は `mime_type` を見て `Blob` を復元する
- 将来の migration を考え、`opfs_path` は DB に明示保存する

## Save Flow Model

1. content script が投稿本文と画像 URL 群を抽出する
2. background が投稿レコードと `storage_status = "pending"` の画像メタデータを保存する
3. background が画像を fetch し、OPFS に書き込む
4. 書き込み成功後に `storage_status = "ready"` とサイズ情報を更新する
5. 書き込み失敗時は `storage_status = "failed"` と `last_error` を更新する

## Deletion Model

1. `x_post_id` に紐づく `media` を先に列挙する
2. OPFS 上の対象ファイルを削除する
3. `media` レコードを削除する
4. `posts` レコードを削除する

削除途中で失敗した場合に備えて、少なくともログで失敗箇所を追えるようにする。

## Validation

### Post

- `x_post_id`, `x_username`, `post_url` は空文字不可
- `post_text` は画像が 1 件以上ある場合のみ空文字を許容する
- `saved_at` は有限な number

### Media

- `media_id`, `x_post_id`, `source_url`, `opfs_path` は空文字不可
- `position` は 0 以上の整数
- `media_type` は現段階では `"image"` 固定
- `storage_status` は定義済みの union のみ
- `x_post_id` は既存投稿に紐づく前提で扱う

## Display Model

viewer 用には保存データをそのまま直接描画せず、投稿と画像を結合した表示モデルへ変換する。

例:

```ts
type ViewerPost = {
  xPostId: string;
  xUsername: string;
  postText: string;
  postUrl: string;
  savedAt: number;
  images: ViewerImage[];
};

type ViewerImage = {
  mediaId: string;
  altText: string | null;
  objectUrl: string | null;
  status: "pending" | "ready" | "failed";
};
```

検索対象は `posts` を中心にし、画像表示は `media` を join して構成する。
