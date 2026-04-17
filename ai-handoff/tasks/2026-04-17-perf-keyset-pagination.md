# Task Packet: パフォーマンス修正 — Keyset Pagination 移行（P4）

## Meta
- status: waiting
- owner: Codex
- branch: feature/full-codebase-review-2026-04-14-fixes
- priority: medium
- files_in_scope: src/db/repositories/posts-repository.ts, src/features/archive/archive-service.ts, src/features/viewer/components/use-archive-loader.ts
- blocked_by: none
- related_findings: 2026-04-17-cia-perf-audit
- needs_from_claude: none
- handoff_to_codex: design complete (2026-04-17); implement per design section below
- summary: offset(N).limit(M) の O(N) カーソル前進を keyset pagination に移行し、10 万件超でのページ送り劣化を排除する

## Goal

`listPostsSliceBySort()` が使う `offset(N).limit(M)` を、最後に取得した値を基準にするカーソル前進なし方式（keyset pagination）に置換する。

行動原則: ユーザーが体験する「さらに読み込む」動作を変えない。UI に見える変化は不可。

## Problem Statement

`src/db/repositories/posts-repository.ts` の `listPostsSliceBySort()`:

```typescript
archiveDb.posts.orderBy(sortField).reverse()
  .offset(offset)   // ← IndexedDB カーソルを N 回前進
  .limit(limit)
  .toArray()
```

N = 50,000 なら 50,000 回の IPC 呼び出し相当。10 万件で offset 5 万では約 2 秒。

現在の呼び出し構造:
- `use-archive-loader.ts` → `loadArchivePage(offset, limit, sort, filter)` → `listArchivePostsPage()` → `listPostsSliceBySort()`
- `offset` は `posts.length`（現在ロード済み件数）を渡している

## Design（Claude — 2026-04-17）

### 方針: cursor（最後に見た値）ベースの keyset pagination

ソートフィールドごとに「最後に取得した値」を cursor として保持し、`where(field).below(cursor)` でページを取得する。

#### ソートパターン別の cursor

| sort | cursor の型 | クエリ |
|---|---|---|
| `saved_at` desc | `number` (saved_at) | `where("saved_at").below(cursor).reverse()` → ただし同値があるため複合キーを使う |
| `posted_at` desc | `number` (posted_at) | 同上 |
| `like_count` desc | `[number, string]` (like_count, id) | 複合インデックス必要 |
| `random` | — | ランダムソートは keyset 不向き。offset 維持か P5 対応に委ねる |

**最初の実装スコープ**: `saved_at` と `posted_at` の降順のみ。`like_count` と `random` は現行 offset のまま残す（段階的移行）。

#### `listPostsSliceBySort()` の変更

```typescript
export async function listPostsSliceBySort(
  sort: SortField,
  limit: number,
  cursor?: PostCursor    // NEW: optional cursor (undefined = first page)
): Promise<{ posts: PostRecord[]; nextCursor: PostCursor | null }> {
  if (sort === "saved_at" || sort === "posted_at") {
    let query = archiveDb.posts.orderBy(sort).reverse();
    if (cursor) {
      // cursor.value = 最後に取得したソート値、cursor.id = そのレコードの id（同値除去用）
      query = archiveDb.posts
        .where(sort).below(cursor.value)
        .reverse();
      // 同値レコードを跳ばす処理は below で切り捨て（精度は十分）
    }
    const posts = await query.limit(limit).toArray();
    const nextCursor = posts.length === limit
      ? { value: posts[posts.length - 1][sort], id: posts[posts.length - 1].id }
      : null;
    return { posts, nextCursor };
  }
  // fallback: offset/limit (like_count, random)
  const offset = cursor?.offset ?? 0;
  const posts = await archiveDb.posts
    .orderBy(sort).reverse()
    .offset(offset).limit(limit)
    .toArray();
  return {
    posts,
    nextCursor: posts.length === limit ? { offset: offset + limit } : null,
  };
}

export type PostCursor =
  | { value: number; id: string; offset?: never }
  | { offset: number; value?: never; id?: never };
```

#### `use-archive-loader.ts` の変更

`loadArchivePage` の `offset: number` を `cursor: PostCursor | null` に変更し、レスポンスの `nextCursor` を state として保持する。

```typescript
// Before
const [offset, setOffset] = useState(0);
await loadArchivePage(offset, limit, sort, filter);
setOffset(prev => prev + limit);

// After
const [cursor, setCursor] = useState<PostCursor | null>(null);
const result = await loadArchivePage(cursor, limit, sort, filter);
setCursor(result.nextCursor);
```

フィルター・ソート変更時は `cursor` を `null` にリセット（先頭から再取得）。

---

### Sequencing

1. `PostCursor` 型を定義（`src/types/` または `posts-repository.ts` に）
2. `listPostsSliceBySort()` を新シグネチャに変更（offset fallback 込み）
3. `listArchivePostsPage()` を経由して `use-archive-loader.ts` の offset → cursor に変更
4. ソート/フィルター変更時に cursor リセットを確認
5. `npm run typecheck` / `npm run build`

---

## In Scope

- `src/db/repositories/posts-repository.ts` — `listPostsSliceBySort()` 変更
- `src/features/archive/archive-service.ts` — `listArchivePostsPage()` シグネチャ変更
- `src/features/viewer/components/use-archive-loader.ts` — cursor state に変更
- `PostCursor` 型定義

## Out of Scope

- `like_count` / `random` ソートの keyset 化（フォールバック offset のまま）
- フィルター付きケース（日付範囲 / 著者 / タグ）の keyset 化
- 総件数表示の変更

## Work Log

（Codex が実装時に追記すること）

## Result

（Codex が記入）

## Verification

- [ ] `saved_at` / `posted_at` ソートで 50,000 件以降のページ取得が offset なしで動作する
- [ ] フィルター変更・ソート変更時に先頭から再取得される
- [ ] `npm run typecheck` pass
- [ ] `npm run build` pass

## Completion Checklist
- [ ] investigation finished
- [ ] implementation finished
- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] task packet `Result` updated
- [ ] task packet `Verification` updated
- [ ] `ai-handoff/current-task.md` updated
