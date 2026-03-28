# Implementation Steps

## Step 1: Posts-only data layer

- `PostRecord` と保存 DTO を定義する
- Dexie schema を `posts` のみに絞る
- 保存、一覧取得、削除、存在確認の repository を作る

## Step 2: Runtime contract

- content script から background に保存要求を送る
- viewer から一覧取得と削除要求を送る
- runtime message と response 型を最小構成で定義する

## Step 3: X DOM integration

- `article[data-testid="tweet"]` を監視する
- 投稿ごとに保存ボタンを 1 回だけ差し込む
- 投稿 permalink から `x_username`, `x_post_id`, `post_url` を抽出する
- `data-testid="tweetText"` から本文を抽出する
- 保存済みなら `保存済み`、未保存なら `保存` を表示する

## Step 4: Viewer MVP

- 保存済み投稿一覧を `saved_at` 降順で表示する
- 各行に削除ボタンを付ける
- 削除後に一覧 state を更新する

## Step 5: Verification

- `npm run typecheck`
- `npm run build`
- Chrome で読み込み、保存 / 一覧 / 削除を手動確認する
