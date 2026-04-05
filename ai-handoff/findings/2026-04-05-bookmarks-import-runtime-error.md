# Finding Note

## Topic

`x.com/i/bookmarks` で bookmarks import 実行時に出る runtime error の現状整理

## Question

ユーザー報告の「ブックマーク走査時エラー」は、どの差分が原因候補で、Claude はどこから再現確認を始めるべきか。

## Conclusion

現時点では bookmarks import の実装自体はビルド可能で、静的検証でも破綻していない。失敗はブラウザ実行時にのみ起きていると見られるが、ユーザーが貼った内容は例外メッセージではなく、ビルド済み content script bundle の先頭から始まるミニファイ済みコード断片で、原因特定には不足している。

実装上の一次候補は 2 つある。
- `src/features/x/bookmarks-import-controls.ts` の新規走査ループと save queue 処理
- `src/features/x/extract-post-from-article.ts` の未コミット差分で追加された quoted post 向け `video_candidates` 取得

追加で、background log から `runtime.message.unhandled_error` が採れており、実際の例外は IndexedDB の `NotFoundError` だった。

`Failed to execute 'objectStore' on 'IDBTransaction': The specified object store was not found.`

このため、少なくとも一部の失敗は content script の走査処理そのものではなく、background 側で既存 DB schema と transaction 対象 store が食い違っている可能性が高い。bookmarks import の実装差分と quoted post `video_candidates` 差分は引き続き候補だが、優先的には Dexie の DB version 更新や old worker / old tab 混在を疑うべき。

## Confidence

medium

## Evidence

- Codex 実装済み差分
  - `src/features/x/bookmarks-import-controls.ts` を新規追加
  - `src/features/x/bootstrap-x-content-script.ts` に `/i/bookmarks` 判定と mount / unmount を追加
  - `src/features/settings/archive-language.ts` に `bookmarked` ラベルと正規化を追加
  - `src/types/archive.ts` に `BuiltInTagKey = "bookmarked"` を追加
- 別テーマの未コミット差分
  - `src/features/x/extract-post-from-article.ts` で quoted post 抽出時にも `getCachedGraphqlVideoCandidates()` を使う変更が入っている
- 検証状況
  - `npm run typecheck` 通過
  - `npm run build` 通過
  - ブラウザ上の `/i/bookmarks` 実操作確認は未完了
- ユーザー報告
  - エラーとして貼られた内容は `var _i=typeof globalThis<"u"...` から始まる bundle 断片
  - 例外名、message、stack の発火行は未取得
- 追加ログ
  - scope: `background`
  - event: `runtime.message.unhandled_error`
  - message: `Runtime message handling failed.`
  - error: `Failed to execute 'objectStore' on 'IDBTransaction': The specified object store was not found.`

## Rejected Hypotheses

- TypeScript の型エラーや build failure が直接原因
  - どちらも通っているため可能性は低い
- `bookmarked` タグ追加だけで必ず落ちる
  - 静的には型・参照とも成立している
- content script の DOM 抽出だけで完結して失敗している
  - background 側の IndexedDB `NotFoundError` が採れているため、少なくとも保存経路にも問題がある

## Suggested Action For Codex

1. `/i/bookmarks` で再現し、Console の実際の例外名・message・stack を取る。
2. background 側でどの runtime message が落ちているかを特定し、その handler が開いている transaction と対象 store 名を確認する。
3. service worker 更新前後で tab / worker / DB version がずれていないかを確認する。特に拡張再読み込み前から開いていたタブで再現するかを見る。
4. 失敗が quoted post を含む投稿だけで起きるなら、`extract-post-from-article.ts` の `video_candidates` 差分も並行して疑う。
