# Task Packet: 整合性修正 — post 保存とタグ割り当ての原子性ギャップ（P7）

## Meta
- status: waiting
- owner: Codex
- branch: feature/full-codebase-review-2026-04-14-fixes
- priority: low
- files_in_scope: src/features/archive/archive-service.ts
- blocked_by: none
- related_findings: 2026-04-17-cia-perf-audit
- needs_from_claude: none
- handoff_to_codex: design complete (2026-04-17); implement per design section below
- summary: assignAutoTags() がトランザクション外で実行されるため post 保存後にタグ欠落が起きうる。トランザクションスコープを拡大して原子性を確保する

## Goal

`archive-service.ts` の `saveArchivePost()` で、`addPost` / `addMediaRecords` のトランザクションに `assignAutoTags()` を含める。

行動原則: 保存済みデータの既存レコードには影響を与えない（schema 変更なし）。

## Problem Statement

`archive-service.ts` の `saveArchivePost()` (lines 205–218):

```typescript
await archiveDb.transaction("rw", [posts, media], async () => {
  await addPost(post);           // ← トランザクション内
  await addMediaRecords(media);  // ← トランザクション内
});
// ↓ トランザクション外
await assignAutoTags(post, autoTags);  // ← ここが失敗すると post だけ残る
```

`assignAutoTags()` が失敗すると `PostRecord` は保存済みだが auto-tags が欠落。
次回同じ post を保存しようとすると「duplicate」扱いになり、タグ再割り当てが試みられる（実質的なリトライがあるため現在は許容されている）。

## Design（Claude — 2026-04-17）

### `post_tags` テーブルをトランザクションに含める

`archiveDb.transaction()` のテーブルリストに `post_tags` を追加し、`assignAutoTags()` を内側に移動する。

```typescript
await archiveDb.transaction("rw", [posts, media, archiveDb.post_tags], async () => {
  await addPost(post);
  await addMediaRecords(media);
  await assignAutoTags(post, autoTags);  // ← トランザクション内に移動
});
```

**事前確認**: `assignAutoTags()` が参照するテーブルが `post_tags` のみであることを確認すること。他テーブルへの書き込みがある場合はそのテーブルもリストに追加する。

`archiveDb.post_tags` が直接参照できない場合は `archiveDb.table("post_tags")` を使う。

### エラーハンドリング

トランザクション内に移動後、`assignAutoTags()` の失敗でトランザクション全体がロールバックされる。
呼び出し元 `saveArchivePost()` の try/catch は変更不要（既存の `storage_status: "failed"` フローに任せる）。

---

## In Scope

- `src/features/archive/archive-service.ts` — `saveArchivePost()` のトランザクションスコープ拡大

## Out of Scope

- `assignAutoTags()` 内のロジック変更
- エラー通知 UI の変更
- メディア blob チェックサム（P8 — 別タスク）

## Work Log

（Codex が実装時に追記すること）

## Result

（Codex が記入）

## Verification

- [ ] `saveArchivePost()` の `assignAutoTags()` がトランザクション内で呼ばれている
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
