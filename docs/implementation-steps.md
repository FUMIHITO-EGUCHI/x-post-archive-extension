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

## Future Video Download Steps

### Step V1: 抽出経路を分離する

- X 固有の動画抽出ロジックを `features/x/` 配下で独立させる
- `video` 要素の `src` から拾える `mp4` と、追加調査が必要な `HLS` を別経路として表現する
- 抽出結果を DOM 依存値のまま保存せず、`SaveVideoInput` 相当の内部型に正規化する

### Step V2: 保存モデルを拡張する

- `media_type = "video"` を追加する前提で型を見直す
- 物理ファイル群を扱う必要があるため、`media_files` 相当のストアを追加する
- `pending`, `downloading`, `ready`, `partial`, `failed` の状態遷移を明文化する

### Step V3: ダウンロード実行層を作る

- `mp4` 直保存フローを最初に作る
- その後で `HLS` playlist 解析、segment 取得、保存処理を追加する
- 結合を行う場合は offscreen document や追加ライブラリの必要性を先に検証する

### Step V4: viewer 再生モデルを作る

- ローカル `mp4` の object URL 再生を先に実装する
- `HLS` 保存の再生方式は別ステップで切り出し、まずは失敗表示や未対応表示でもよい形にする
- 一覧はサムネイル中心、詳細でのみ再生開始する

### Step V5: 失敗処理と容量管理を固める

- 保存前容量見積り、保存中進捗、保存失敗理由の表示を追加する
- 途中保存ファイルのロールバック方針か `partial` 保持方針かを決める
- 投稿削除時の動画ファイル群削除を transaction 的に扱えるようにする

### Step V6: 検証

- `mp4` 直リンク動画の保存 / 再生 / 削除
- `HLS` 動画の取得可否確認
- 長尺動画でのメモリ使用量確認
- 再読み込み後のローカル再生確認
- 失敗時の `partial` / `failed` 表示確認
## Tagging Steps

1. Extend archive types and Dexie schema with `tags` and `post_tags`.
2. Generate auto tags from hashtags when a post snapshot is saved.
3. Add runtime messages for manual tag add/remove.
4. Show tags in the viewer and support filter by tag.
5. Verify duplicate prevention, delete cleanup, `npm run typecheck`, and `npm run build`.
