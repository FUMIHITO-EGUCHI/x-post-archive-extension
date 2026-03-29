# MVP Plan

## Goal

次の段階では、X の投稿を 1 件ずつ保存し、本文と添付画像を viewer で見返せる状態までを完成条件とする。
検索対象は引き続き投稿メタデータ中心とし、画像本体の保存先だけを OPFS に分離する。

## Included

- X の投稿ごとの保存ボタン
- DOM からの投稿本文抽出
- DOM からの画像メタデータ抽出
- `posts` ストアへの投稿保存
- `media` ストアへの画像メタデータ保存
- OPFS への画像バイナリ保存
- viewer での本文表示
- viewer での画像サムネイル表示
- 投稿削除時の画像削除

## Excluded

- 動画
- スレッド
- タグ
- 高度な検索 UI
- 画像編集
- 画像の重複排除
- 自動再取得 / 自動更新
- 失敗ジョブの再実行キュー

## Done Criteria

1. 画像付き投稿を保存すると、本文と画像メタデータが保存される
2. 画像本体が OPFS に保存される
3. viewer で投稿本文と画像が同時に見える
4. 画像なし投稿も従来どおり保存できる
5. 投稿削除時に関連画像メタデータと OPFS ファイルが削除される
6. 画像保存に失敗した場合の状態が viewer またはログで判別できる

## Save Policy

- 1 投稿の保存単位を維持する
- 投稿保存時に画像があれば、同一トランザクション内でメタデータを登録する
- OPFS 書き込みは IndexedDB transaction 外で行うため、保存状態を段階管理する
- 少なくとも `pending`, `ready`, `failed` を区別できるようにする

## Non-goals

- 画像の URL だけ保存して後で毎回ネットワーク取得する構成にはしない
- Base64 を IndexedDB に直接詰め込む構成にはしない
- viewer から直接 X の CDN URL を参照する構成にはしない

## Follow-up Memo

MVP の外にある将来候補は [future-features.md](/c:/Users/kurah/Documents/Git/x-post-archive-extension/docs/future-features.md) で管理する。
