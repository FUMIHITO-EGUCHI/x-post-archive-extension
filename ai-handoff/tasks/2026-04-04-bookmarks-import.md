# Task Packet - ブックマーク一括取得

## Goal

`x.com/i/bookmarks` ページに likes import と同等の一括取得 UI を追加する。自動スクロールしながらブックマーク済み投稿を保存し、保存時に `bookmarked` システムタグを付与する。

## Requested Action

実装を進めたうえで、現在の runtime error まで含めて Claude が引き継げる状態に整理する。

## In Scope

- `src/types/archive.ts` の `BuiltInTagKey` に `"bookmarked"` を追加
- `src/features/settings/archive-language.ts` に `bookmarked` のラベルと正規化を追加
- `src/features/x/bookmarks-import-controls.ts` を新規追加
- `src/features/x/bootstrap-x-content-script.ts` に `/i/bookmarks` の mount / unmount を追加
- ブックマーク保存時に `bookmarked` タグを明示付与

## Out Of Scope

- ブックマーク詳細の追加抽出や自動同期
- `/i/bookmarks` 以外の URL への対応
- コミットや push

## Constraints

- TypeScript strict + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`
- content script は素の TypeScript で実装し、React は使わない
- 少なくとも `npm run typecheck` と `npm run build` を通す

## Compressed Findings

### 1. bookmarks import 本体は実装済み

`src/features/x/bookmarks-import-controls.ts` を新規追加し、likes import と同じ構造の overlay UI、走査ループ、save queue、debug trace を `/i/bookmarks` 用に複製している。

### 2. 保存時は `bookmarked` タグを明示付与

likes import 側は `buildLocalizedDefaultAutoTags(..., { includeLikedTag: true })` だが、bookmarks import 側は `getDefaultAutoTagLabel(language, "bookmarked")` を追加して付与する実装になっている。

### 3. content script 配線済み

`src/features/x/bootstrap-x-content-script.ts` で `/i/bookmarks` 判定時に `ensureBookmarksImportControls()`、それ以外で `removeBookmarksImportControls()` を呼ぶようにしている。

### 4. runtime error は未解決

ユーザー報告では、走査時に `var _i=typeof globalThis<"u"...` から始まるミニファイ済み bundle 断片が表示されている。これは例外メッセージそのものではなく、実際の error name / message / stack はまだ採れていない。

追加で background log が採れており、`runtime.message.unhandled_error` として次の error が記録されている。

`Failed to execute 'objectStore' on 'IDBTransaction': The specified object store was not found.`

つまり少なくとも一部の失敗は IndexedDB transaction で存在しない store を引こうとしている。

### 5. 別テーマの未コミット差分が混在

`src/features/x/extract-post-from-article.ts` に quoted post 向け `video_candidates` 取得の変更が入っている。bookmarks import 本体と同じ未コミット状態にあるため、runtime error の原因候補から外せない。

## Files To Read First

- `src/features/x/bookmarks-import-controls.ts`
- `src/features/x/bootstrap-x-content-script.ts`
- `src/features/x/likes-import-controls.ts`
- `src/features/x/extract-post-from-article.ts`
- `ai-handoff/findings/2026-04-05-bookmarks-import-runtime-error.md`

## Acceptance Criteria

1. `x.com/i/bookmarks` で import overlay が表示される
2. 自動スクロールしながら visible posts を収集できる
3. 保存した投稿に `bookmarked` タグが付く
4. `npm run typecheck` が通る
5. `npm run build` が通る
6. 走査時 runtime error の実際の原因箇所が特定される

## Open Questions

- runtime error は import overlay 起動直後か、走査中か、保存時か
- quoted post を含む投稿だけで落ちるか
- error は `bookmarks-import-controls.ts` 側か `extract-post-from-article.ts` 側か
- error を出している runtime message はどれか
- old tab / old service worker / old DB schema の食い違いがあるか
- ユーザーが貼った bundle 断片の直前に、Console 上でどの例外が出ていたか

## Codex Plan

- likes import の既存実装をベースに bookmarks import を追加する
- built-in tag / archive language / content script 配線を揃える
- 静的検証を通してから、runtime error は handoff 用 finding に切り出す

## Codex Result

- `src/features/x/bookmarks-import-controls.ts` を新規追加し、likes import 相当の UI と走査・保存フローを `/i/bookmarks` 向けに実装した
- `src/features/x/bootstrap-x-content-script.ts` に bookmarks page 判定と mount / unmount を追加した
- `src/features/settings/archive-language.ts` に `bookmarked` の表示名と正規化を追加した
- `src/types/archive.ts` の `BuiltInTagKey` に `"bookmarked"` を追加した
- 保存時は `buildLocalizedDefaultAutoTags()` の結果に `getDefaultAutoTagLabel(language, "bookmarked")` を追加して、bookmark タグを明示付与する形にした
- ユーザーから runtime error 報告が来たため、現状を `ai-handoff/findings/2026-04-05-bookmarks-import-runtime-error.md` に切り出した

## Changed Files

- `src/features/x/bookmarks-import-controls.ts`
- `src/features/x/bootstrap-x-content-script.ts`
- `src/features/settings/archive-language.ts`
- `src/types/archive.ts`
- `src/features/x/extract-post-from-article.ts`

## Verification

- `npm run typecheck`
- `npm run build`
- ブラウザ上の `/i/bookmarks` 実動作確認は未完了

## Remaining Issues

- ユーザーが貼った内容は error message ではなくミニファイ済み bundle 断片で、発火箇所が特定できていない
- background log では IndexedDB `NotFoundError` が出ており、保存経路の transaction / object store 名の不一致が疑われる
- `src/features/x/extract-post-from-article.ts` の quoted post 向け `video_candidates` 差分が同じ未コミット状態に混在しており、bookmarks import 本体と原因を分離できていない
- `/i/bookmarks` の browser 実機で再現し、console 上の例外本文を採る必要がある

## Suggested Next Action

1. `/i/bookmarks` で再現し、例外名・message・stack を採る
2. background 側で落ちている runtime message と transaction 対象 store を特定する
3. `bookmarks-import-controls.ts` と `extract-post-from-article.ts` のどちらが原因かを切り分ける
4. 原因が確定したら、bookmarks import 本体と無関係な差分は別コミット候補として分離する
