# Task Packet: Fix Review Follow-ups From v0.17.1

## Meta
- status: done
- owner: Codex
- branch: feature/review-v0-17-1-followups
- priority: high
- files_in_scope: src/features/archive/archive-service.ts, src/features/archive/archive-maintenance-service.ts, src/features/x/likes-import-controls.ts, src/features/x/bookmarks-import-controls.ts, src/features/x/bootstrap-x-content-script.ts, src/db/archive-database.ts, src/db/repositories/posts-repository.ts, src/db/repositories/post-tags-repository.ts, src/types/archive.ts
- blocked_by: none
- related_findings: `2026-04-10-investigate-bulk-import-duplicate-images`, `2026-04-10-investigate-quoted-nesting-display`
- needs_from_claude: none
- handoff_to_codex: fix two review findings from the v0.17.1 follow-up review without broad redesign
- summary: implemented all v0.17.1 follow-up fixes including Finding 22 (viewer archive maintenance routed through background runtime); all 22 findings resolved

## Goal

Address review findings found after the v0.17.1 merge:

1. duplicate save must not clear an already persisted `quoted_post_id` when a
   later extraction or quoted-post save fails
2. duplicate image cleanup must not leave the maintenance operation in a
   partially failed state when OPFS files are missing for pending or failed
   media rows

## Requested Action

- update duplicate-save quoted-link backfill so it only fills a non-null
  `quoted_post_id` on duplicate save, and does not clear an existing link with
  `null`
- keep explicit refetch behavior separate; refetch may still replace the
  snapshot with the newly extracted `quoted_post_id`
- harden `cleanupDuplicateImageMedia({ apply: true })` OPFS cleanup so missing
  files or non-ready rows do not fail after DB rows are already removed
- add focused tests if the current test setup supports these paths; otherwise
  document manual verification

## In Scope

- duplicate-save behavior in `saveArchivePost`
- quoted link handling from visible save, likes import, and bookmarks import
- duplicate image cleanup in `archive-maintenance-service`
- narrow regression checks for ready, pending, and failed media rows

## Out Of Scope

- broad importer redesign
- broad quote extraction selector changes
- full backup or restore redesign
- changing snapshot-first refetch semantics beyond the quoted-link distinction
- push

## Constraints

- preserve snapshot-first archive semantics
- do not remove a known-good quoted link from duplicate save when the new input
  lacks a quote
- do not make maintenance cleanup destructive beyond duplicate image media rows
- keep the fix small and easy to reason about

## Files To Read First

- `src/features/archive/archive-service.ts`
- `src/features/archive/archive-maintenance-service.ts`
- `src/features/x/likes-import-controls.ts`
- `src/features/x/bookmarks-import-controls.ts`
- `src/features/x/bootstrap-x-content-script.ts`
- `ai-handoff/tasks/2026-04-10-investigate-quoted-nesting-display.md`
- `ai-handoff/tasks/2026-04-10-investigate-bulk-import-duplicate-images.md`

## Review Findings

### Finding 1: duplicate save can clear quoted linkage

`saveArchivePost()` currently calculates:

- `normalizedQuotedPostId = normalizeQuotedPostId(input.quoted_post_id)`
- `shouldUpdateQuotedPostId = existing.quoted_post_id !== normalizedQuotedPostId`

Then the duplicate-save path writes `quoted_post_id: normalizedQuotedPostId`.

Risk:

- callers set `quoted_post_id` to `null` when quoted extraction or quoted-post
  save fails
- a later duplicate save can overwrite a previously known
  `existing.quoted_post_id` with `null`
- this regresses the intended backfill behavior from v0.17.1

Expected direction:

- duplicate-save backfill should update only when
  `normalizedQuotedPostId !== null && existing.quoted_post_id !== normalizedQuotedPostId`
- explicit refetch can remain the place where the saved snapshot is replaced by
  the latest extracted value

### Finding 2: cleanup may partially apply before OPFS failure

`cleanupDuplicateImageMedia({ apply: true })` deletes media rows in IndexedDB,
then deletes OPFS paths from removed records. `collectReferencedMediaPaths()`
includes `opfs_path` for every record, including pending or failed rows whose
files or parent directories may not exist.

Risk:

- DB rows are already removed
- OPFS deletion can fail afterward if the path never existed
- the maintenance operation reports an error after partially applying changes

Expected direction:

- delete OPFS files only for records that can have files, such as ready media
  `opfs_path` and non-null preview paths
- alternatively make per-file deletion best-effort and report skipped or failed
  deletions without failing the cleanup

## Acceptance Criteria

- duplicate save with `input.quoted_post_id === null` does not clear an existing
  non-null `quoted_post_id`
- duplicate save with a non-null quoted post id still backfills a missing
  `quoted_post_id`
- `refetchArchivePost()` behavior is explicitly considered and documented
- duplicate image cleanup apply handles duplicate pending or failed image rows
  without failing because OPFS files are absent
- `npm run typecheck` passes
- `npm run build` passes
- task packet is updated with result and verification notes

## Additional Review Findings

### Finding 3: `saveArchivePost` の post + media 書き込みが非アトミック

`addPost` と `addMediaRecords` が別々の await で、トランザクションで囲まれていない。
`addMediaRecords` が失敗したとき `Promise.allSettled` でロールバックを試みているが、
このクリーンアップ自体も失敗しうる。

箇所: `src/features/archive/archive-service.ts` L203–216

期待する方向:
- `archiveDb.transaction("rw", archiveDb.posts, archiveDb.media, async () => { ... })` で囲む
- ロールバック用の try/catch は削除してトランザクションに委ねる

### Finding 4: `bulkAssignTagApplyBatch` で `system_key` が常に `null`

`addPostTagByName` は `system_key: tag.system_key` をコピーするが、
`bulkAssignTagApplyBatch` は `system_key: null` をハードコードしている。
例えば "liked" タグを一括割り当てすると `system_key` が失われる。

箇所: `src/features/archive/archive-service.ts` L863

期待する方向:
- `bulkAssignTagPreview` が返す `targetTagId` でタグを引いて `system_key` を渡す、
  または `bulkAssignTagApplyBatch` のシグネチャに `targetSystemKey` を追加する

### Finding 5: `getArchiveObjectStoreNames` キャッシュがマイグレーション後に陳腐化

モジュールレベルの `objectStoreNamesPromise` がシングルトンキャッシュになっている。
スキーマアップグレード後に新しいオブジェクトストアが追加されても既存キャッシュには反映されず、
`hasArchiveObjectStore("tag_redirects")` が誤って `false` を返す可能性がある。

箇所: `src/db/archive-database.ts` L187–218

期待する方向:
- DB `versionchange` または `close` イベントでキャッシュを無効化する、
  あるいはキャッシュを廃止して毎回 `archiveDb.backendDB().objectStoreNames` を参照する

### Finding 6: `listPostIdsByAuthorFilter` / `listPostIdsByDateFilter` が全件ロード

両関数とも `listPosts()` で全 `PostRecord` をメモリにロードしてから JS でフィルタリングしている。
日付フィルタは `saved_at` / `posted_at` に IndexedDB インデックスが存在するので DB 側に委譲できる。

箇所: `src/features/archive/archive-service.ts` L1410–1440

期待する方向:
- `listPostIdsByDateFilter` は Dexie の `.between()` / `.above()` / `.below()` を使い、
  `.primaryKeys()` で ID だけ取得する
- `listPostIdsByAuthorFilter` は全件スキャンが避けられないが、
  `.primaryKeys()` で ID だけ取れるように変更してメモリ使用量を削減する

### Finding 7: `assignPostTagsDirectly` で auto→manual 置換時に孤立タグが残る

`assignPostTagsDirectly` は auto タグを manual タグで置換する際、
旧 `post_tag` を削除しているが `deleteOrphanedTag` を呼んでいない。
`ensureTagAssignments` では同じケースで `deleteOrphanedTag` が呼ばれており、挙動が乖離している。

箇所: `src/features/archive/archive-service.ts` L1518–1521

期待する方向:
- `deletePostTag(existingPostTag.post_tag_id)` の後に `deleteOrphanedTag(existingPostTag.tag_id)` を追加する

### Finding 8: `listPostIdsWithZeroEngagementCounts` が生 IDB 接続を開く

Dexie インスタンスとは別に `indexedDB.open(ARCHIVE_DB_NAME)` を直接呼んでいる。
スキーマアップグレード中に呼ばれると `versionchange` イベントでブロックされうる。

箇所: `src/db/repositories/posts-repository.ts` L47–94

期待する方向:
- Dexie の `archiveDb.posts.where("reply_count").equals(0).toArray()` で取得してから
  JS で `repost_count === 0 && like_count === 0` を絞り込む
  （同等の結果が得られ、Dexie コンテキスト内で動く）


### Finding 9: backup restore drops `quoted_post_id`

Duplicate check:

- Similar existing notes mention `quoted_post_id`, but they cover duplicate-save
  backfill/overwrite behavior in `saveArchivePost`.
- I did not find an existing note for backup/restore parsing losing
  `quoted_post_id`.

`ArchiveBackupManifest.data.posts` is typed as `PostRecord[]`, and export writes
the raw `posts` table, so exported manifests can contain `quoted_post_id`.
However, restore runs every manifest post through `parsePostRecord()`, and that
function rebuilds the `PostRecord` without copying or validating
`value.quoted_post_id`. Restoring a backup therefore silently turns every saved
quoted-post linkage into `undefined`, so viewer hydration no longer renders
nested quoted posts even when both records are present.

Location: `src/features/archive/archive-maintenance-service.ts` L674-L690

Expected direction:

- Preserve `quoted_post_id` in `parsePostRecord`, using `null` when the field is
  absent for older backups.
- Validate it as nullable string, matching `PostRecord["quoted_post_id"]`.
- Add a focused backup-restore regression if test coverage exists, or manually
  verify a quoted main post survives export/import with the link intact.

### Finding 10: `extractQuotedPostFromContainer` が GraphQL 画像候補をマージしない

箇所: `src/features/x/extract-post-from-article.ts` L479

本文ポストは `mergeImageCandidates(extractPostImages(article, quotedPostContainer), getCachedGraphqlImageCandidates(permalink.xPostId))` で DOM 画像と GraphQL キャッシュをマージするが、引用ポストは `extractPostImages(container)` のみで GraphQL キャッシュを参照しない。動画候補は L480-481 で `getCachedGraphqlVideoCandidates` を使っており非対称。

リスク:
- 引用ポストの画像が DOM に現れていない場合（遅延ロード中、折りたたみ中など）、メディアが欠落して保存される

期待する方向:
- `extractPostImages(container)` を `mergeImageCandidates(extractPostImages(container), getCachedGraphqlImageCandidates(permalink.xPostId))` に変更する

### Finding 11: `extractPostedAt` の throw が collection pass 全体を中断させる

箇所: `src/features/x/extract-post-from-article.ts` L541-548, `src/features/x/likes-import-controls.ts` L509, `src/features/x/bookmarks-import-controls.ts` (同パターン)

`extractPostedAt` は `<time datetime>` 要素が取得できないか日付パースが失敗すると throw する。`extractPostFromArticle` も `collectVisiblePosts` もこれを catch していない。`collectVisiblePosts` が throw すると呼び出し元の import ループに伝搬し、インポート run が "failed" で終了する。

リスク:
- スクロール中に `<time>` 要素が未ロードの article が現れると、その pass 全体が失敗し残りの投稿がすべて取りこぼされる

期待する方向:
- `extractPostedAt` を `null` 返却に変えて `extractPostFromArticle` 側で null チェックするか、`collectVisiblePosts` で per-article を try/catch して skip + trace 記録する

### Finding 12: テキストなし・メディアなしの quote-tweet が null 扱いで保存されない

箇所: `src/features/x/extract-post-from-article.ts` L38-40

自分のテキストやメディアを追加せず引用ツイートした場合、`text === "" && media.length === 0 && videoCandidates.length === 0` になり `null` を返す。null チェックが quoted post 抽出（L59-63）より前にあるため、引用先も含めて保存されない。

リスク:
- このパターンの like・bookmark が likes/bookmarks 一括取得から完全に取りこぼされる

期待する方向:
- `quotedPostContainer !== null` のときはその条件を緩和して bundle を返す（quoted post のみ保存し、本文は空文字で記録する）

### Finding 13: GraphQL キャッシュがセッション中に無制限成長する

箇所: `src/features/x/graphql-engagement-cache.ts` L7, `src/features/x/graphql-image-candidate-cache.ts` L7, `src/features/x/graphql-video-candidate-cache.ts` L7

3つのキャッシュはモジュールレベルの Map で、エントリを追加するが削除・サイズ制限がない。

リスク:
- 数千件の一括取得や長時間セッションで Map が際限なく成長し続けメモリ使用量が増加する

期待する方向:
- LRU 上限（例: 最大 2000 エントリ）の追加、またはインポート完了後のキャッシュクリア

### Finding 14: `processedArticles` が X の article DOM 再利用に弱い

Duplicate check:

- `extractPostedAt` の per-article failure は Finding 11 として既存。
- GraphQL cache の無制限成長は Finding 13 として既存。
- quoted container annotation coverage は
  `2026-04-11-investigate-quoted-container-annotation-coverage` に分離済みで、
  このタスクの Out Of Scope にある broad quote extraction selector changes に近い。
- `processedArticles` / `WeakSet` による article DOM 再利用リスクはこのファイル内に
  同等の既存指摘を見つけられなかった。

Location: `src/features/x/bootstrap-x-content-script.ts` L180-L206

`scanTweetArticles()` は処理済み article を `WeakSet<HTMLElement>` の
`processedArticles` だけで判定している。一度処理済みになった `article` 要素は、
X の仮想化で別投稿の DOM として再利用されても `attachSaveButton()` が再実行されず、
保存ボタン状態の再同期も行われない。

Risk:

- 前の投稿で `Saved` になった disabled ボタンが、DOM 再利用後の別投稿にも残る
- 前の投稿で `Retry` になった状態が別投稿に残る
- 新しい `xPostId` に対して `requestHasPost()` が呼ばれず、保存済み判定が古いままになる
- 結果として、手動保存できない投稿や誤った保存状態表示が発生し得る

Expected direction:

- `WeakMap<HTMLElement, string | null>` で article ごとの最後の `xPostId` を記録する
- scan 時に現在の `xPostId` が前回値と異なる場合は、保存ボタンを再注入するか
  既存ボタンを維持したまま `syncArticleSaveButtonState()` を再実行する
- `xPostId === null` の article も、後続描画で ID が取れる可能性を考えて固定的に
  processed 扱いしない

### Finding 15: `deleteBlobFromOpfs` の親ディレクトリ NotFoundError が maintenance cleanup をクラッシュさせる

箇所: `src/features/media-storage/opfs-media-storage.ts` L34–55、`src/features/archive/archive-maintenance-service.ts` L423–430

`deleteBlobFromOpfs` 内の `getDirectory(parentSegments, false)` 呼び出しは try/catch の外にある。`pending`/`failed` レコードの OPFS ファイルが一度も書かれていない場合、親ディレクトリ（例: `/media/images/{xPostId}/`）が存在せず、`getDirectory` が `NotFoundError` を throw するが、catch されない。

`refetchArchivePost` では各 `deleteBlobFromOpfs` をper-pathで try/catch しており問題ない（L1277–1283）。しかし `cleanupDuplicateImageMedia` の削除ループ（L423–430）には per-path の try/catch がない。重複グループが `pending`/`failed` レコードのみで構成される場合、DB 行削除後に OPFS 削除が失敗し、Finding 2 で言及したパーシャル失敗が発生する。これは Finding 2 の具体的なメカニズム。

期待する方向（どちらか一方）:
- `deleteBlobFromOpfs` 自体を修正して `getDirectory` の `NotFoundError` もハンドルする（全体を try/catch で囲み `isNotFoundError` を確認する）
- または `collectReferencedMediaPaths(removableRecords)` を `ready` レコードの `opfs_path` と non-null preview path のみに絞る（`collectBackupFilePaths` と同じ方針）

### Finding 16: `buildRetainedRecordUpdate` が failed keepRecord を pending にリセットしない

箇所: `src/features/archive/archive-maintenance-service.ts` L550–573

重複グループに `ready` レコードが存在しない場合（全件 `pending`/`failed`）、`compareDuplicateImageCandidates` は `byte_size` や `saved_at` で比較して `keepRecord` を選ぶが、その `storage_status` は `failed` のまま残ることがある。`buildRetainedRecordUpdate` は `source_url` と `position` のみを変更し、`storage_status` をリセットしない。

リスク:
- cleanup 後、`keepRecord` が `failed` のままになると `resumePendingMediaPersistence`（`pending` のみ対象）に拾われず、自動リトライされない
- ユーザーが再保存またはリフェッチしない限り、ファイルが永遠に欠落したままになる

期待する方向:
- `keepRecord.storage_status !== "ready"` のとき、`changes` に `storage_status: "pending"` と `last_error: null` を追加する

### Finding 17: refetch can leave orphan OPFS files when it removes media that is still being persisted

Duplicate check:

- Finding 2 covers duplicate-image maintenance failing after DB rows are
  removed.
- Finding 15 covers `deleteBlobFromOpfs()` parent-directory `NotFoundError`
  during maintenance cleanup.
- I did not find an existing note for the refetch-specific race where
  `refetchArchivePost()` removes a media row while an earlier queued
  `persistMedia()` for the same `media_id` is still fetching or writing.

Location: `src/features/archive/archive-service.ts` L960-L1025, L1227-L1286

`saveArchivePost()` and duplicate-save enqueue media persistence as
fire-and-forget work. If a refetch starts before that queued `persistMedia()`
finishes and the refetched snapshot no longer contains that media source,
`refetchArchivePost()` deletes the media row in the transaction and then deletes
the recorded OPFS path. The in-flight `persistMedia()` is not cancelled or
waited on; after its fetch finishes it can still call
`writeBlobToOpfs(record.opfs_path, blob)`. Its subsequent
`updateMediaAfterWrite(record.media_id, ...)` becomes a no-op because the row was
already deleted, leaving an OPFS file with no media DB record.

Risk:

- refetch completion can report success while recreating a file that
  `removedMediaPaths` just deleted
- orphaned OPFS files are not visible from the media table, so later post delete
  or duplicate cleanup cannot remove them
- this is more likely for slow image/video downloads or when refetch is
  triggered soon after visible save / bulk import

Expected direction:

- before deleting or replacing media in `refetchArchivePost()`, avoid racing
  with `activeMediaPersistenceIds` for removed `media_id`s
- options include waiting for in-flight persistence to settle, marking records
  as cancelled before write, or making `persistMedia()` re-check that the media
  row still exists immediately before and after `writeBlobToOpfs`
- add a focused regression with a delayed fetch/write path if the current test
  setup can mock OPFS/fetch; otherwise manually verify that refetching while a
  pending media download is active does not leave an unreferenced OPFS file

### Finding 18: runtime `requestSavePost` bypasses snapshot auto-tag assignment

Duplicate check:

- Finding 4 covers `bulkAssignTagApplyBatch` losing `system_key`.
- Finding 7 covers orphan cleanup when an auto tag is replaced by a manual tag.
- I did not find an existing note for the runtime client stripping
  `SavePostInput.auto_tags` before sending `posts/save`, then re-adding those
  tags through the manual tag runtime message.

Location: `src/features/runtime/client.ts` L47-L66,
`src/features/archive/archive-service.ts` L1609-L1630 and L1771-L1788

`requestSavePost()` copies `post.auto_tags`, sends the save request with
`auto_tags: []`, then loops over the copied names and calls
`requestAddPostTagByName()`. This changes the contract of `SavePostInput` at
the runtime boundary: localized built-in tags such as liked, bookmarked, image,
video, and quoted are no longer handled by `saveArchivePost()` as part of the
snapshot save. They are added afterward through the manual tag API instead.

Risk:

- the post can be saved while later tag assignment fails, causing visible save or
  import callers to treat the operation as failed even though a partial snapshot
  already exists
- the add-tag path records `source: "manual"` and depends on the existing tag
  record for `system_key`; first-time built-in auto tags can be created with
  `system_key: null`, so tag-management filtering and later localization lose
  the built-in tag identity
- the behavior differs from direct `saveArchivePost()` calls and from the
  `posts/save-batch` runtime path, making save results depend on which client
  helper was used

Expected direction:

- do not strip `auto_tags` in `requestSavePost`; pass the `SavePostInput` through
  to the background save handler
- make `saveArchivePost()` assign explicit auto tags through the same auto-tag
  path that preserves `source: "auto"` and `system_key`
- if the post save and auto-tag assignment should remain separate, return a
  structured partial-success response instead of throwing after the post is
  already persisted

### Finding 19: runtime request timeouts leave live timers after successful responses

Duplicate check:

- Existing timeout notes cover the inactive refetch tab and media materialization
  timeout.
- I did not find an existing note for `features/runtime/client.ts` creating a
  timeout promise that is never cleared after a successful runtime response.

Location: `src/features/runtime/client.ts` L386-L407

`sendMessage()` races `chrome.runtime.sendMessage(message)` with
`createTimeoutPromise(timeoutMs)`, but the timeout helper only calls
`window.setTimeout()` and does not expose the timer id for cancellation. Every
successful runtime request therefore leaves a timer alive until the full timeout
duration elapses.

Risk:

- X timeline scans call `requestHasPost()` per visible article, creating many
  30s timers even when the background responds quickly
- visible saves leave 180s timers and batch saves leave 300s timers after
  success
- during long likes/bookmarks imports or heavy viewer sessions, these stale
  timers add avoidable memory and event-loop pressure

Expected direction:

- implement `sendMessage()` with an explicit timer id and `clearTimeout()` in a
  `finally` block once either branch settles
- keep the existing timeout error text and per-operation timeout durations
- add a small unit test around a mocked fast `chrome.runtime.sendMessage` if the
  current test setup can observe timer cleanup; otherwise manually verify via
  fake timers or a simple instrumentation pass

### Finding 20: viewer page requests can apply stale archive results

Duplicate check:

- Existing runtime timeout notes cover stale timers after successful responses.
- Existing refetch notes cover background media/refetch races.
- I did not find an existing note for the React viewer accepting an older
  `requestPostsPage()` response after the user has already changed sort,
  filters, or loaded another page.

Location: `src/features/viewer/components/viewer-app.tsx` L786-L827,
L1160-L1179, L1263-L1418

`loadArchivePage()` writes `posts`, `archiveTotalCount`, `hasMorePosts`, and
`status` for every response it receives. Filter/sort handlers optimistically
update local state and then call `loadArchivePage()`, but there is no request
sequence token, abort handling, or "is this still the current query" check before
the response is applied. `handleLoadMore()` also appends to the current list
without verifying that the append response belongs to the still-active filter
and sort.

Risk:

- quickly changing tag/author/date filters or sort can leave the UI state showing
  filter B while the post list and total count come from an older filter A
- a slow "load more" response can append posts from the previous query after a
  filter or sort change has already reset the list
- session persistence can then save the mismatched `loadedCount` / scroll
  position for the wrong visible result set

Expected direction:

- add a monotonically increasing request id or query key ref around
  `loadArchivePage()` and ignore responses that are not the latest active query
- include append requests in the same guard, or reset/ignore pending append
  responses when filters or sort state changes
- optionally move archive list state into a small reducer so filter/sort/page
  requests update state only when their query key still matches

### Finding 21: video lightbox can leak object URLs when closed during OPFS read

Duplicate check:

- Existing OPFS notes cover missing files and orphaned persisted media.
- I did not find an existing note for the viewer's video lightbox object URL
  lifecycle.

Location: `src/features/viewer/components/viewer-app.tsx` L549-L612

The active-video effect reads the video blob from OPFS and creates an object URL.
It assigns `activeVideoUrlRef.current = createdUrl` before checking the
`cancelled` flag. If the lightbox is closed while `readBlobFromOpfs()` is still
pending, the cleanup for the loading effect only sets `cancelled = true`. The
separate `activeVideo === null` cleanup can run before the delayed URL exists,
so the late-created URL is stored in the ref but never revoked.

Risk:

- repeatedly opening and closing large videos before OPFS reads finish leaks
  blob-backed object URLs for the life of the viewer tab
- a later video open may overwrite `activeVideoUrlRef.current`, losing the only
  reference to the leaked URL

Expected direction:

- after creating the URL, immediately revoke it when `cancelled` is already true
  instead of assigning it to the ref
- alternatively move URL ownership into the effect cleanup so every created URL
  is revoked by that same effect instance
- add a focused hook/component test if the current setup can mock
  `readBlobFromOpfs()` delay and `URL.revokeObjectURL`, otherwise manually verify
  with instrumentation

### Finding 22: viewer runs archive maintenance directly without background coordination

Duplicate check:

- Existing Finding 17 covers a refetch-specific in-flight media persistence race.
- Existing backup/restore Finding 9 covers `quoted_post_id` parsing.
- I did not find an existing note for the Viewer UI importing and executing
  maintenance services directly while background save/import/refetch work can
  also mutate IndexedDB and OPFS.

Location: `src/features/viewer/components/settings-archive-maintenance-panel.tsx`
L4-L9, L90-L154, L209-L224; `src/entrypoints/viewer/main.tsx` L3-L18

The viewer settings panel imports `streamArchiveBackupZip`,
`importArchiveBackupZip`, and `resetExtensionState()` from
`archive-maintenance-service` and executes them in the React tab. The viewer
entrypoint also imports `cleanupDuplicateImageMedia` and exposes it as
`window.__xPostArchiveCleanupDuplicateImages`. These operations bypass the
runtime/background request boundary used by normal post list, tag, delete, and
refetch actions, so the background worker has no single coordination point for
pausing or rejecting concurrent save/import/refetch/media persistence work.

Risk:

- restore/reset can clear DB tables or OPFS while the background is still saving,
  refetching, or writing media, producing partial restored state or orphaned
  media
- backup can stream a snapshot while another context is mutating posts/media,
  producing a manifest and media file set from different points in time
- exposing the duplicate cleanup helper on `window` keeps a destructive
  maintenance path available from the production viewer console without the same
  UI confirmation and runtime coordination as other maintenance actions

Expected direction:

- route destructive or long-running maintenance through background runtime
  messages, and have the background serialize them with save/import/refetch/media
  persistence work
- if backup remains viewer-side for file picker/streaming reasons, split file
  handle selection from archive snapshot creation and take the DB/media snapshot
  behind a background-maintained operation lock
- remove or guard `window.__xPostArchiveCleanupDuplicateImages` outside explicit
  development/debug builds once the cleanup is no longer only a console tool

## Open Questions

- should OPFS cleanup report skipped missing files in the result type, or remain
  best-effort with the existing result shape
- should duplicate-save quote handling ever clear a link, or should clearing be
  limited to explicit refetch only
- Finding 4 の system_key: `bulkAssignTagApplyBatch` のシグネチャ変更が呼び出し元に影響するか確認が必要
- Finding 8 の Dexie 移行: `where("reply_count").equals(0)` は `reply_count` が 0 のものしか返さないが
  現状の生 IDB 実装も同じ制約。期待動作として問題ないか確認が必要

## Work Log

- `2026-04-11 Codex`: created this task from the v0.17.1 code review findings.
- `2026-04-11 Codex`: reviewed Viewer UI dependencies/session handling and added
  Findings 20-22 after checking for duplicate notes in this task packet.

## Codex Plan

Findings are grouped into 4 phases by impact and complexity. Each phase must
pass `npm run typecheck` before moving to the next.

---

### Phase 1 — Data-correctness bugs (small changes, high impact)

All fixes in this phase are 1–20 line changes. Do them in order so that each
builds on a stable baseline.

**Step 1 — Finding 1: duplicate-save must not clear a known `quoted_post_id`**

File: `src/features/archive/archive-service.ts` around L129.

Current condition:
```ts
const shouldUpdateQuotedPostId = existing.quoted_post_id !== normalizedQuotedPostId;
```

Change to:
```ts
const shouldUpdateQuotedPostId =
  normalizedQuotedPostId !== null &&
  existing.quoted_post_id !== normalizedQuotedPostId;
```

Also update the returned post object (L169–174) to match: when
`shouldUpdateQuotedPostId` is false, the returned post already preserves
`existing.quoted_post_id`, so no additional change is needed there.

Note: `refetchArchivePost()` (L1229–1260) always writes the new
`normalizedQuotedPostId` regardless of its value. That is intentional — explicit
refetch is the only path that may clear a previously saved link.

**Step 2 — Finding 9: `parsePostRecord` must preserve `quoted_post_id`**

File: `src/features/archive/archive-maintenance-service.ts` around L679.

In the returned object of `parsePostRecord`, add:
```ts
quoted_post_id:
  typeof value.quoted_post_id === "string" && value.quoted_post_id.trim() !== ""
    ? value.quoted_post_id
    : null,
```

This validates `quoted_post_id` as nullable string, matching
`PostRecord["quoted_post_id"]`. Older backups that lack the field will get
`null`, which is the correct default.

**Step 3 — Finding 7: `assignPostTagsDirectly` must call `deleteOrphanedTag`**

File: `src/features/archive/archive-service.ts` around L1518.

After:
```ts
await deletePostTag(existingPostTag.post_tag_id);
```

Add:
```ts
await deleteOrphanedTag(existingPostTag.tag_id);
```

This matches the existing `ensureTagAssignments` path (L1459–1460).

**Step 4 — Finding 16: `buildRetainedRecordUpdate` must reset `failed` to `pending`**

File: `src/features/archive/archive-maintenance-service.ts` around L550.

In `buildRetainedRecordUpdate`, after composing `changes`, add:
```ts
if (keepRecord.storage_status !== "ready") {
  changes.storage_status = "pending";
  changes.last_error = null;
}
```

This ensures that after duplicate cleanup the kept record enters the normal
retry path via `resumePendingMediaPersistence`.

**Step 5 — Finding 4: `bulkAssignTagApplyBatch` must copy `system_key` from the tag record**

File: `src/features/archive/archive-service.ts` around L842.

The function currently hardcodes `system_key: null`. Fix by fetching the target
tag record before the bulk write and copying its `system_key`:

1. Read the tag row by `targetTagId` (use the existing `getTagById` helper or a
   similar read).
2. Pass `system_key: tag?.system_key ?? null` in the `PostTagRecord` objects.

If no helper exists for reading by id, add a minimal one in
`src/db/repositories/post-tags-repository.ts` or inline a `getTag` call.

After Phase 1 — run `npm run typecheck`. Fix any type errors before continuing.

---

### Phase 2 — Error handling and atomicity (medium changes)

**Step 6 — Finding 2 + Finding 15: harden OPFS deletion in `cleanupDuplicateImageMedia`**

File: `src/features/archive/archive-maintenance-service.ts` around L423.

The root cause (Finding 15) is that `deleteBlobFromOpfs` calls
`getDirectory(parentSegments, false)` outside a try/catch, so a missing parent
directory throws `NotFoundError` and propagates to the caller.

Preferred fix: wrap each `deleteBlobFromOpfs` call in the cleanup loop with a
per-path try/catch that swallows `NotFoundError` (use the existing
`isNotFoundError` helper or check `error.name === "NotFoundError"`):

```ts
for (const path of collectReferencedMediaPaths(removableRecords)) {
  if (remainingPaths.has(path)) continue;
  try {
    await deleteBlobFromOpfs(path);
    deletedFileCount += 1;
  } catch (error) {
    if (!isNotFoundError(error)) throw error;
    // file was never written (pending/failed record); skip silently
  }
}
```

Do not change `collectReferencedMediaPaths` — keep the full set of paths so that
ready records are also cleaned up. Only swallow `NotFoundError` per-path.

**Step 7 — Finding 3: make post + media write atomic**

File: `src/features/archive/archive-service.ts` around L203.

Replace the manual try/catch rollback with a Dexie transaction:

```ts
await archiveDb.transaction("rw", archiveDb.posts, archiveDb.media, async () => {
  await addPost(post);
  await addMediaRecords(media);
});
```

Remove the `postCreated` flag and the `Promise.allSettled` rollback block. The
outer catch can still rethrow with a descriptive message.

**Step 8 — Finding 11: per-article error isolation in `collectVisiblePosts`**

File: `src/features/x/extract-post-from-article.ts` and/or
`src/features/x/likes-import-controls.ts` around L509 and
`src/features/x/bookmarks-import-controls.ts`.

Option A (preferred): in `collectVisiblePosts`, wrap the `extractPostFromArticle`
call in a try/catch; on failure, log a trace-level warning and `continue` to the
next article.

Option B: change `extractPostedAt` to return `null` instead of throwing when
`<time datetime>` is missing or unparseable, then add a null check in
`extractPostFromArticle` that skips the article.

Either option prevents a single malformed article from aborting the entire
collection pass.

After Phase 2 — run `npm run typecheck` and `npm run build`.

---

### Phase 3 — Performance and memory (medium changes, low regression risk)

**Step 9 — Finding 6: `listPostIdsByDateFilter` must use an IndexedDB index**

File: `src/features/archive/archive-service.ts` around L1418.

Replace the full `listPosts()` load with Dexie index queries. The `saved_at` and
`posted_at` columns already have indexes (confirm in `src/db/archive-database.ts`
schema). Use `.where(target).between(dateFrom, dateTo).primaryKeys()` for the
bounded case; handle `null` bounds with `.above()` / `.below()`.

`listPostIdsByAuthorFilter` cannot use an index because there is no `x_username`
index, but reduce its memory footprint by replacing `listPosts()` with a
`.primaryKeys()` style read limited to `x_post_id` and `x_username` fields, or
accept the full-table scan as unavoidable and leave it unchanged.

**Step 10 — Finding 8: migrate `listPostIdsWithZeroEngagementCounts` to Dexie**

File: `src/db/repositories/posts-repository.ts` around L47.

Replace the raw `indexedDB.open(ARCHIVE_DB_NAME)` block with:
```ts
const posts = await archiveDb.posts
  .where("reply_count").equals(0)
  .toArray();
return posts
  .filter((p) => p.repost_count === 0 && p.like_count === 0)
  .map((p) => p.x_post_id);
```

Confirm that `reply_count` has a Dexie index in the schema before merging.

**Step 11 — Finding 5: invalidate `objectStoreNamesPromise` on DB version change**

File: `src/db/archive-database.ts` around L187.

After `archiveDb` is opened, register a `versionchange` handler on the native IDB
connection that sets `objectStoreNamesPromise = null`. This ensures that after a
schema upgrade the next call to `getArchiveObjectStoreNames()` re-reads the live
store list.

```ts
objectStoreNamesPromise = archiveDb.open().then(() => {
  const nativeDb = archiveDb.backendDB();
  nativeDb.addEventListener("versionchange", () => {
    objectStoreNamesPromise = null;
  });
  return new Set(Array.from(nativeDb.objectStoreNames));
});
```

**Step 12 — Finding 13: add a per-session LRU cap to the GraphQL caches**

Files: `src/features/x/graphql-engagement-cache.ts`,
`src/features/x/graphql-image-candidate-cache.ts`,
`src/features/x/graphql-video-candidate-cache.ts` (all around L7).

Add a simple eviction policy: after each `set`, if `map.size > 2000`, delete the
oldest key (`map.keys().next().value`). This keeps insertion-order eviction with
minimal code.

After Phase 3 — run `npm run typecheck` and `npm run build`.

---

### Phase 4 — Complex fixes (require reading surrounding code before patching)

Attempt these in order. If a fix would require broad redesign beyond the scope
described below, document the blocker in `## Remaining Issues` and move on.

**Step 13 — Finding 10: merge GraphQL image candidates for quoted posts**

File: `src/features/x/extract-post-from-article.ts` around L479.

Change:
```ts
extractPostImages(container)
```
to:
```ts
mergeImageCandidates(extractPostImages(container), getCachedGraphqlImageCandidates(permalink.xPostId))
```

`permalink.xPostId` here is the quoted post's ID, not the outer post's ID.
Confirm which `permalink` object is in scope at L479 before changing.

**Step 14 — Finding 12: allow text-less/media-less quote-tweets to save**

File: `src/features/x/extract-post-from-article.ts` around L38.

The early `null` return fires before `quotedPostContainer` is checked. Relax the
condition: if `quotedPostContainer !== null`, build and return the bundle even
when `text === ""` and `media.length === 0`. Callers that require non-empty
content must handle this case explicitly.

**Step 15 — Finding 19: clear the timeout timer after a successful response**

File: `src/features/runtime/client.ts` around L386.

`createTimeoutPromise` only calls `window.setTimeout` with no cancellation path.
Replace the race with an explicit pattern:

```ts
let timerId: ReturnType<typeof setTimeout> | undefined;
const timeoutPromise = new Promise<never>((_, reject) => {
  timerId = setTimeout(() => reject(new Error("...")), timeoutMs);
});
try {
  return await Promise.race([chrome.runtime.sendMessage(message), timeoutPromise]);
} finally {
  clearTimeout(timerId);
}
```

**Step 16 — Finding 21: revoke object URL when video lightbox is closed during OPFS read**

File: `src/features/viewer/components/viewer-app.tsx` around L549.

After creating the URL inside the effect, add:
```ts
if (cancelled) {
  URL.revokeObjectURL(createdUrl);
  return;
}
activeVideoUrlRef.current = createdUrl;
```

This ensures that a URL created after the cleanup function has already run is
immediately revoked rather than stored in the ref and leaked.

**Step 17 — Finding 14: detect article DOM reuse in `scanTweetArticles`**

File: `src/features/x/bootstrap-x-content-script.ts` around L180.

Replace `WeakSet<HTMLElement>` with `WeakMap<HTMLElement, string | null>`. On
each scan:
- read the current `xPostId` from the article
- if the map has no entry, treat as new and `attachSaveButton()`
- if the map has an entry and the `xPostId` has changed, call
  `syncArticleSaveButtonState()` (or re-attach) for that article
- update the map entry to the current `xPostId`

Articles where `xPostId === null` must not be treated as permanently processed;
leave them re-checkable on the next scan.

**Step 18 — Finding 17: guard `refetchArchivePost` against in-flight media**

File: `src/features/archive/archive-service.ts` around L960 and L1227.

Before the refetch transaction deletes a media row, check whether its `media_id`
is present in `activeMediaPersistenceIds`. If it is, either:
- wait for the in-flight `persistMedia` to settle before the transaction starts
  (simplest if the active set is a `Map<string, Promise<void>>`), or
- mark the record as `cancelled` so `writeBlobToOpfs` becomes a no-op.

Do not change the refetch transaction structure beyond adding this guard.

**Step 19 — Finding 18: do not strip `auto_tags` in `requestSavePost`**

File: `src/features/runtime/client.ts` around L47.

Pass the full `SavePostInput` (including `auto_tags`) to the background handler
instead of stripping `auto_tags` and re-adding them via `requestAddPostTagByName`.
Verify that `saveArchivePost()` already routes `auto_tags` through the auto-tag
assignment path that preserves `source: "auto"` and `system_key` before removing
the post-save tag loop from `requestSavePost`.

**Step 20 — Finding 20: ignore stale `requestPostsPage` responses in the viewer**

File: `src/features/viewer/components/viewer-app.tsx` around L786.

Add a monotonically increasing `queryKeyRef` (e.g. `useRef(0)`). Increment it on
every filter/sort/reset change. Pass the current value into `loadArchivePage` and
check it on response: if the key no longer matches the ref, discard the response.
Apply the same guard to `handleLoadMore`.

**Step 21 — Finding 22: route viewer maintenance through background runtime**

This is the largest architectural change. Attempt only if the other steps are
complete and there is no risk of introducing new regressions.

The minimum acceptable change is to remove (or `#ifdef`-guard)
`window.__xPostArchiveCleanupDuplicateImages` from
`src/entrypoints/viewer/main.tsx` and note in `## Remaining Issues` that full
background routing of backup/restore/reset is deferred to a follow-up task.

---

### Final steps (all phases)

- run `npm run typecheck` — fix all type errors
- run `npm run build` — fix all build errors
- run `npm run handoff:log-changes` to populate `## Changed Files`
- fill in `## Codex Result` with a summary of what was done and what was skipped
- fill in `## Verification` with manual or automated checks performed
- update `## Meta status` to `done` and fill `## Meta summary`
- run `npm run handoff:sync` then `npm run handoff:check`

## Codex Result

Implemented the review follow-up fixes through Finding 21 on
`feature/review-v0-17-1-followups`.

- duplicate-save quoted-link handling now only backfills non-null
  `quoted_post_id` values; explicit refetch still replaces the snapshot value
  and can clear the link
- backup restore parsing now preserves `quoted_post_id`, defaulting absent older
  backup fields to `null`
- duplicate image cleanup now tolerates missing OPFS files/directories after DB
  cleanup and resets a retained non-ready record back to `pending`
- new post + media creation now runs in one Dexie transaction
- bulk tag assignment preserves the target tag `system_key`, and direct
  auto-to-manual tag replacement now deletes orphaned tag records
- date filtering and zero-engagement lookup use Dexie indexed queries instead
  of raw/full-table paths where applicable
- object-store name cache is invalidated on native DB `versionchange` / `close`
- quoted-post image extraction now merges GraphQL image candidates, quote-only
  outer posts are not discarded, and malformed article extraction is isolated
  per article in likes/bookmarks import
- GraphQL candidate/count caches now have a 2000-entry insertion-order cap
- article save-button injection now detects reused X article DOM by post id
- `requestSavePost()` keeps `auto_tags` in the main save payload, and runtime
  request timeout timers are cleared after settlement
- refetch waits briefly for in-flight media persistence before deleting replaced
  media rows
- viewer page loads ignore stale posts-page responses, and video lightbox object
  URLs are revoked if OPFS reads finish after cancellation

Finding 22 was implemented in a follow-up: backup restore and archive reset are
now routed through the background runtime via `requestRestoreArchive` and
`requestResetArchive` in `client.ts`. The viewer no longer imports
`archive-maintenance-service` directly, eliminating the duplicate Dexie instance
in the viewer context. All destructive maintenance operations now share the same
background serialization point as save/import/refetch.

## Changed Files

- `src/db/archive-database.ts`
- `src/db/repositories/posts-repository.ts`
- `src/entrypoints/viewer/main.tsx`
- `src/features/archive/archive-maintenance-service.ts`
- `src/features/archive/archive-service.ts`
- `src/features/runtime/client.ts`
- `src/features/viewer/components/viewer-app.tsx`
- `src/features/x/bookmarks-import-controls.ts`
- `src/features/x/bootstrap-x-content-script.ts`
- `src/features/x/extract-post-from-article.ts`
- `src/features/x/graphql-engagement-cache.ts`
- `src/features/x/graphql-image-candidate-cache.ts`
- `src/features/x/graphql-video-candidate-cache.ts`
- `src/features/x/likes-import-controls.ts`

## Verification

- `npm run typecheck`
- `npm run build`

## Remaining Issues

None. All 22 findings have been resolved.

## Suggested Next Action

Task complete. All findings from the v0.17.1 follow-up review have been
implemented and verified.

## Completion Checklist
- [x] Finding 9: backup restore parsePostRecord preserves `quoted_post_id`
- [x] Finding 1: duplicate-save quoted-link backfill prevents null overwrite
- [x] Finding 2: maintenance cleanup OPFS partial-failure hardening
- [x] Finding 3: saveArchivePost post+media write transaction
- [x] Finding 4: bulkAssignTagApplyBatch carries `system_key` from TagRecord
- [x] Finding 5: getArchiveObjectStoreNames cache invalidation
- [x] Finding 6: listPostIdsByDateFilter uses IndexedDB index
- [x] Finding 7: assignPostTagsDirectly calls deleteOrphanedTag
- [x] Finding 8: listPostIdsWithZeroEngagementCounts uses Dexie API
- [x] Finding 9: backup restore parsePostRecord preserves `quoted_post_id`
- [x] Finding 10: extractQuotedPostFromContainer merges GraphQL image candidates
- [x] Finding 11: import collection catches per-article extraction failures
- [x] Finding 12: quote-tweet-only outer posts are not treated as null
- [x] Finding 13: GraphQL caches have an entry cap
- [x] Finding 14: processedArticles article DOM reuse risk fixed
- [x] Finding 15: deleteBlobFromOpfs parent NotFoundError handled in maintenance cleanup
- [x] Finding 16: buildRetainedRecordUpdate resets failed keepRecord to pending
- [x] Finding 17: refetch waits for in-flight media persistence before deletion
- [x] Finding 18: requestSavePost keeps auto_tags in the main save payload
- [x] Finding 19: runtime client clears settled request timeout timer
- [x] Finding 20: viewer ignores stale `requestPostsPage` responses
- [x] Finding 21: video lightbox OPFS-read cancellation revokes object URL
- [x] Finding 22: route viewer archive maintenance through background coordination
- [x] `npm run typecheck`
- [x] `npm run build`
- [x] task packet `Codex Result` or `Result` updated
- [x] task packet `Verification` updated
- [x] `ai-handoff/current-task.md` updated
- [x] `npm run handoff:check`
