# Requirements

## Goal

X の各投稿に保存ボタンを差し込み、押した投稿を IndexedDB に保存し、別タブの一覧画面で確認と削除ができる Chrome 拡張を作る。

## Initial Scope

初版で実現すること:

1. `article[data-testid="tweet"]` ごとに保存ボタンを表示する
2. 保存ボタン押下で 1 投稿を保存する
3. 保存済み投稿を一覧画面で新しい順に表示する
4. 一覧画面から `x_post_id` 指定で削除する

初版で実装しないこと:

- タグ
- 検索
- ユーザー集計
- 画像 / 動画保存
- 反応数保存
- スレッド保存
- 自動更新
- 論理削除

## Saved Fields

- `x_post_id`
- `x_username`
- `post_text`
- `post_url`
- `saved_at`

## DOM Extraction Policy

- CSS クラス名には依存しない
- `article[data-testid="tweet"]` を投稿単位として扱う
- `href` と `data-testid` を優先して使う
- `x_username` と `x_post_id` と `post_url` は投稿 permalink から取る
- `post_text` は投稿 article 内の `data-testid="tweetText"` から取る

## Responsibility Split

以下は分離する。

1. 投稿 DOM 検出
2. 保存ボタン差し込み
3. DOM からの投稿データ抽出
4. IndexedDB 保存
5. 保存済み判定
6. 一覧表示
7. 削除

## Runtime Direction

- Manifest V3
- WXT
- TypeScript strict
- React は viewer のみ
- content script と background は素の TypeScript
- 保存処理は content script から background へ message で依頼する
