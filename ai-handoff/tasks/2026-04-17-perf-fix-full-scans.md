# Task Packet: パフォーマンス修正 — 全件スキャン排除（High Priority）

## Meta
- status: active
- owner: Codex
- branch: feature/full-codebase-review-2026-04-14-fixes
- priority: high
- files_in_scope: src/features/archive/archive-service.ts, src/db/repositories/posts-repository.ts, src/db/archive-db.ts
- blocked_by: none
- related_findings: 2026-04-17-cia-perf-audit
- needs_from_claude: none
- handoff_to_codex: design complete (2026-04-17); implement per design section below
- summary: CIA 監査で特定した 3 つの全件スキャンを count/index クエリに置換し、5 万件超での UI 劣化を防ぐ

## Goal

`archive-service.ts` に残る 3 箇所の `listPosts()`（全件スキャン）を、件数カウントまたはインデックスクエリに置換する。

行動原則: 動作仕様（表示内容・フィルタ結果）を変えない。DB スキーマの migration バージョンを正しく上げること。

## Problem Statement

### P1: `getArchiveSummary()` — 3 並列全件スキャン

`archive-service.ts` の `getArchiveSummary()` (lines 428–468) が:
```typescript
const [posts, mediaRecords, postTags] = await Promise.all([
  listPosts(),              // ← 全件取得
  archiveDb.media.toArray(), // ← 全件取得
  listAllPostTags()         // ← 全件取得
]);
```
で 3 テーブルを全件取得し、JS でカウントを計算している。

返却する `ArchiveSummaryRecord` は:
```typescript
{
  postCount, imageCount, videoCount, mediaCount,
  accountCount, tagCount, mediaBytes
}
```

### P2: `listArchiveUserSummaries()` — 全件スキャン後 JS distinct

`archive-service.ts` の `listArchiveUserSummaries()` (line 330) が:
```typescript
const posts = await listPosts();
// JS で distinct x_username + reduce
```

フィルターモーダルの著者ドロップダウンを開くたびに発火。

### P3: `listPostIdsByAuthorFilter()` — 全件スキャン後 JS filter

`archive-service.ts` の `listPostIdsByAuthorFilter()` (line 1457 付近) が:
```typescript
const posts = await listPosts();
return posts
  .filter(p => p.x_username === username)
  .map(p => p.id);
```

著者フィルター適用のたびに全件スキャン。

## Design（Claude — 2026-04-17）

### P1 修正: `getArchiveSummary()` を count クエリに置換

`listPosts()` / `toArray()` を Dexie の `.count()` + 集計クエリに変える。

```typescript
export async function getArchiveSummary(): Promise<GetArchiveSummaryResponse> {
  const [
    postCount,
    imageCount,
    videoCount,
    mediaSizeResult,
    accountCount,
    tagCount,
  ] = await Promise.all([
    archiveDb.posts.count(),
    archiveDb.media.where("media_type").equals("image").count(),
    archiveDb.media.where("media_type").equals("video").count(),
    archiveDb.media.toCollection().primaryKeys().then(async (keys) => {
      // mediaBytes は全 MediaRecord の file_size 合計が必要。
      // count だけでは出ないため、file_size のみ取り出す軽量なアプローチを使う:
      const records = await archiveDb.media.toCollection().keys(); // primary keys
      // NOTE: Dexie に "sum" aggregation はないため、toArray で file_size だけ取得する
      //       件数が多い場合は Web Worker への移譲が推奨だが、現段階では許容する
      const sizes = await archiveDb.media.toArray().then(rs => rs.map(r => r.file_size ?? 0));
      return sizes.reduce((acc, s) => acc + s, 0);
    }),
    archiveDb.posts.orderBy("x_username").uniqueKeys().then(keys => keys.length),
    archiveDb.post_tags.count(),
  ]);

  const mediaCount = imageCount + videoCount;

  return {
    summary: {
      postCount,
      imageCount,
      videoCount,
      mediaCount,
      accountCount,
      tagCount,
      mediaBytes: mediaSizeResult,
    }
  };
}
```

> **注意**: `mediaBytes` は `file_size` 合計のため `toArray()` が必要。ただし `posts` / `post_tags` の全件取得は排除できる。`media` テーブルは posts より件数が少ない前提で許容。将来的に重くなれば `file_size` インデックスを追加して対処する。

`accountCount` は `x_username` インデックスによる `uniqueKeys()` で O(インデックスページ数) に改善。

### P2 修正: `listArchiveUserSummaries()` を `x_username` インデックスで置換

#### 2-a: `x_username` インデックス追加（DB schema 変更）

`src/db/archive-db.ts` のスキーマ定義を確認し、`posts` テーブルに `x_username` インデックスが存在しない場合は追加する。

```typescript
// archive-db.ts の stores 定義例（現状確認してから編集）
posts: "id, saved_at, posted_at, x_username, ..."
//                              ^^^^^^^^^^^^ 追加
```

schema version を 1 つ上げ、upgrade ハンドラを追加する（データ変換なし — インデックス追加のみなので空の upgrade で可）。

#### 2-b: `listArchiveUserSummaries()` の実装置換

```typescript
export async function listArchiveUserSummaries(): Promise<ListArchiveUserSummariesResponse> {
  // x_username インデックスで distinct ユーザー名一覧取得
  const usernames = await archiveDb.posts
    .orderBy("x_username")
    .uniqueKeys() as string[];

  // 各ユーザーの最新投稿から display_name / avatar_url を取得
  const userSummaries: UserSummary[] = await Promise.all(
    usernames.map(async (username) => {
      const latestPost = await archiveDb.posts
        .where("x_username").equals(username)
        .last();
      return {
        x_username: username,
        display_name: latestPost?.x_display_name ?? username,
        avatar_url: latestPost?.x_avatar_url ?? null,
      };
    })
  );

  return { users: userSummaries };
}
```

> **注意**: `UserSummary` の型を `src/types/` で確認してから実装すること。フィールド名が異なる場合は型に合わせる。

### P3 修正: `listPostIdsByAuthorFilter()` をインデックスクエリに置換

```typescript
async function listPostIdsByAuthorFilter(username: string): Promise<string[]> {
  return archiveDb.posts
    .where("x_username").equals(username)
    .primaryKeys() as Promise<string[]>;
}
```

P2 で `x_username` インデックスを追加していれば、このクエリはインデックスを使う。

---

### Sequencing（実装順）

1. **`src/db/archive-db.ts`** — `x_username` インデックス追加（schema version up + 空 upgrade）
2. **P3** — `listPostIdsByAuthorFilter()` 置換（シンプル、1 行に近い変更）
3. **P2** — `listArchiveUserSummaries()` 置換（インデックス前提）
4. **P1** — `getArchiveSummary()` 置換（3 並列スキャン除去）

各ステップ後に `npm run typecheck` と `npm run build` を通すこと。

---

## In Scope

- `src/db/archive-db.ts` — `x_username` インデックス追加（schema version up）
- `src/features/archive/archive-service.ts` — P1/P2/P3 の 3 関数置換
- `src/db/repositories/posts-repository.ts` — 必要に応じて helper 追加

## Out of Scope

- keyset pagination（P4 — Medium、別タスク）
- ランダムソートのメモリ最適化（P5 — Medium、別タスク）
- `posts/list` dead code 削除（P6 — Medium、別タスク）
- viewer-app.tsx の分解（別 task packet: 2026-04-17-viewer-app-second-pass）

## Work Log

- `2026-04-17 Codex`: Added Dexie schema version 14 with `posts.x_username`, `posts.[x_username+saved_at]`, and `media.media_type` indexes.
- `2026-04-17 Codex`: Replaced `getArchiveSummary()` post/tag/media count paths with count/index queries; `mediaBytes` now uses cursor aggregation instead of `toArray()`.
- `2026-04-17 Codex`: Replaced `listArchiveUserSummaries()` and `listPostIdsByAuthorFilter()` full post scans with username index based lookups.

## Result

- Implemented P1-P3 performance fixes:
  - `getArchiveSummary()` no longer calls `listPosts()` or `listAllPostTags()`.
  - `listArchiveUserSummaries()` no longer calls `listPosts()`.
  - `listPostIdsByAuthorFilter()` no longer calls `listPosts()`.
  - Existing username normalization behavior is preserved by grouping raw indexed usernames through `normalizeAuthorFilter()`.
  - Latest display name selection for user summaries is preserved with `[x_username+saved_at]`.

## Verification

- [x] `npm run typecheck` pass after index/helper changes.
- [x] `npm run build` pass after function replacements.
- [x] `getArchiveSummary()` does not call `listPosts()`.
- [x] `listArchiveUserSummaries()` does not call `listPosts()`.
- [x] `listPostIdsByAuthorFilter()` does not call `listPosts()`.


## Completion Checklist
- [x] investigation finished
- [x] implementation finished
- [x] `npm run typecheck`
- [x] `npm run build`
- [x] task packet `Result` updated
- [x] task packet `Verification` updated
- [x] `ai-handoff/current-task.md` updated
