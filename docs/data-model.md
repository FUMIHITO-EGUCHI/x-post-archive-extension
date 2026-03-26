# Data Model

## 方針

- 投稿を最小単位として保存する
- スレッドは投稿群のまとまりとして保持する
- 自動タグと手動タグを分離する
- 保存時点の反応数はスナップショットとして分離する
- 将来のメディア保存を見越してメディア参照を独立させる

## エンティティ

### posts

保存対象の最小単位。

主な項目:

- `id`
- `authorId`
- `authorHandle`
- `authorDisplayName`
- `content`
- `permalink`
- `createdAt`
- `savedAt`
- `inReplyToPostId`
- `threadId`
- `saveSource`

### threads

投稿者本人の返信連投チェーン。

主な項目:

- `id`
- `rootPostId`
- `authorId`
- `authorHandle`
- `postIds`
- `savedAt`

### tags

自動タグと手動タグを同一テーブルで保持しつつ、`kind` で区別する。

主な項目:

- `id`
- `label`
- `slug`
- `kind`
- `createdAt`

### postTags

投稿とタグの関連。

主な項目:

- `id`
- `postId`
- `tagId`
- `kind`
- `createdAt`

### mediaRefs

将来の画像・動画保存に備えたメディア参照情報。

主な項目:

- `id`
- `postId`
- `mediaType`
- `sourceUrl`
- `previewUrl`
- `altText`
- `position`

### postMetrics

保存時点の反応数スナップショット。

主な項目:

- `postId`
- `replyCount`
- `repostCount`
- `likeCount`
- `quoteCount`
- `capturedAt`

## 初期インデックス方針

- `posts.id`
- `posts.authorHandle`
- `posts.createdAt`
- `posts.savedAt`
- `threads.rootPostId`
- `threads.authorHandle`
- `tags.slug`
- `tags.kind`
- `postTags.postId`
- `postTags.tagId`
- `mediaRefs.postId`
- `postMetrics.postId`

## 表示用モデルとの分離

保存データは DB 用の正規化寄りモデルとして保持し、viewer では必要に応じて結合済み表示モデルへ変換する。
今回の初期セットアップでは、表示モデルはまだ最小限に留める。

