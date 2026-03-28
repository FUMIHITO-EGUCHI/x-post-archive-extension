# Implementation Steps

## Step 1: 型とデータ層を分離する

- `PostRecord` に加えて `MediaRecord`, `SavePostWithMediaInput` を定義する
- `src/types/archive.ts` を投稿型とメディア型で整理する
- Dexie schema を `posts` + `media` に拡張する
- `posts-repository` と `media-repository` の責務を分ける

## Step 2: OPFS アクセス層を作る

- `src/features/media-storage/` のような専用領域を作る
- `navigator.storage.getDirectory()` から OPFS root を取得する
- `writeBlob`, `readBlob`, `deleteFile`, `deleteDirectoryIfEmpty` を持つ薄い adapter を作る
- OPFS path の組み立てを 1 か所に集約する

## Step 3: X 画像抽出を追加する

- 投稿 article から保存対象画像だけを抽出する
- アバターや装飾画像を除外する判定を追加する
- 抽出結果を DOM 依存型のまま広げず、正規化して runtime input に変換する
- 画像なし投稿でも同じ保存 API を使える形にする

## Step 4: background 保存フローを拡張する

- `posts/save` を `posts/save-with-media` 相当に拡張するか、後方互換を保った新 payload にする
- 先に post と media metadata を `pending` で保存する
- その後に画像 fetch と OPFS 書き込みを行う
- 成功時は `ready`、失敗時は `failed` に更新する
- 投稿削除時は関連 media と OPFS ファイルも削除する

## Step 5: viewer 表示モデルを追加する

- post 一覧取得時に media を join する selector を作る
- `ready` の画像だけ object URL 化する
- `pending` は保存中表示、`failed` は失敗表示にする
- object URL の revoke を忘れない

## Step 6: エラーハンドリングを固める

- 画像 1 枚だけ失敗したケースを扱う
- 全画像失敗でも本文保存は残すかどうかを実装で明示する
- viewer から失敗状態を判別できるようにする
- console だけに依存せず、最低限の UI 表示か状態表示を用意する

## Step 7: 検証

- `npm run typecheck`
- `npm run build`
- 画像なし投稿の保存 / 表示 / 削除
- 画像 1 枚投稿の保存 / 表示 / 削除
- 複数画像投稿の順序維持
- 画像保存失敗時の `failed` 表示
- 再読み込み後に OPFS 画像が再表示されること
