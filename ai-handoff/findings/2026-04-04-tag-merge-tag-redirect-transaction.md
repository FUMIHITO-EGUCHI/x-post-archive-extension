# 2026-04-04 tag merge / tag_redirects transaction finding

## Summary

タグ統合オーバーレイで「今後このタグ名が使われたときも同じ統合先へ自動変換する」を有効にした状態で統合すると、

- `Failed to execute 'objectStore' on 'IDBTransaction': The specified object store was not found.`
- `NotFoundError: Failed to execute 'objectStore' on 'IDBTransaction': The specified object store was not found.`

が発生する。

軽くコードを追った限り、`mergeTags()` の Dexie transaction に `tag_redirects` が含まれていないのに、transaction 内で `archiveDb.tag_redirects` に触っているのが原因候補として最有力。

## Repro Scope

- Settings > タグ管理
- 2 つのタグを選択
- 統合オーバーレイを開く
- 「今後このタグ名が使われたときも同じ統合先へ自動変換する」をオン
- 統合実行

ユーザー報告上は「チェックあり」で発生。

## Evidence

### DB schema

`tag_redirects` は DB version 11 で追加されている。

- [archive-database.ts](C:/Users/kurah/Documents/Git/x-post-archive-extension/src/db/archive-database.ts#L159)

### mergeTags transaction

`mergeTags()` は transaction 開始時に渡している store が `tags` と `post_tags` だけ。

- [archive-service.ts](C:/Users/kurah/Documents/Git/x-post-archive-extension/src/features/archive/archive-service.ts#L567)

ただし transaction 本体では次を呼んでおり、どちらも `archiveDb.tag_redirects` を使う。

- `listTagRedirectsByTargetTagId(sourceTagId)`
- `putTagRedirect(...)`
- `upsertTagRedirect(...)`

該当箇所:

- [archive-service.ts](C:/Users/kurah/Documents/Git/x-post-archive-extension/src/features/archive/archive-service.ts#L582)
- [archive-service.ts](C:/Users/kurah/Documents/Git/x-post-archive-extension/src/features/archive/archive-service.ts#L600)
- [archive-service.ts](C:/Users/kurah/Documents/Git/x-post-archive-extension/src/features/archive/archive-service.ts#L610)
- [tag-redirects-repository.ts](C:/Users/kurah/Documents/Git/x-post-archive-extension/src/db/repositories/tag-redirects-repository.ts#L10)

Dexie / IndexedDB 的には、native transaction に含まれていない object store を transaction 中に開こうとして `objectStore(...)` で `NotFoundError` になる説明と一致する。

### Comparison with other paths

同じ `tag_redirects` を使う他の処理は transaction に明示的に `archiveDb.tag_redirects` を含めている。

- manual tag add: [archive-service.ts](C:/Users/kurah/Documents/Git/x-post-archive-extension/src/features/archive/archive-service.ts#L396)
- rename tag: [archive-service.ts](C:/Users/kurah/Documents/Git/x-post-archive-extension/src/features/archive/archive-service.ts#L439)

この差分から見ても、`mergeTags()` 側の store 指定漏れの可能性が高い。

## Likely Fix

`mergeTags()` の transaction 宣言を次の形に揃える。

- `archiveDb.tags`
- `archiveDb.tag_redirects`
- `archiveDb.post_tags`

つまり [archive-service.ts](C:/Users/kurah/Documents/Git/x-post-archive-extension/src/features/archive/archive-service.ts#L567) の transaction 引数へ `archiveDb.tag_redirects` を追加する。

## Notes

- `listTagRedirectsByTargetTagId(sourceTagId)` はチェック有無に関係なく実行されるので、実際には「チェックあり」専用ではなく統合経路全体の問題である可能性がある。
- 今回は軽い切り分けだけで、未修正。
