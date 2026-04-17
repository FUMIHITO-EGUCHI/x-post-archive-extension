# Task Packet: 整合性・可用性修正 — メディア checksum + OPFS クォータ graceful handling（P8/P9）

## Meta
- status: waiting
- owner: Codex
- branch: feature/full-codebase-review-2026-04-14-fixes
- priority: low
- files_in_scope: src/types/archive.ts, src/features/archive/opfs-service.ts, src/features/archive/archive-service.ts
- blocked_by: none
- related_findings: 2026-04-17-cia-perf-audit
- needs_from_claude: none
- handoff_to_codex: design complete (2026-04-17); implement per design section below
- summary: MediaRecord に SHA-256 checksum フィールドを追加し OPFS 書き込みエラーに対する graceful degradation を改善する

## Goal

1. **P8**: `MediaRecord` に `checksum` フィールドを追加し、OPFS 書き込み時に SHA-256 を計算して保存する
2. **P9**: OPFS クォータ超過・書き込みエラー時に UI へ通知できる状態管理を追加する

行動原則: 既存の `MediaRecord` データとの後方互換性を保つ（checksum は nullable）。

## Problem Statement

### P8: メディア blob チェックサムなし

`MediaRecord`（`src/types/archive.ts`）に `checksum` フィールドがない。OPFS への blob 書き込み後、ファイルが壊れていても検知できない。将来のエクスポート/インポート機能で問題になる。

### P9: OPFS クォータ超過の graceful handling

`writeBlobToOpfs()` が失敗すると `storage_status: "failed"` に落ちるが、クォータ超過か他エラーかを区別していない。ユーザーへの通知もない。

## Design（Claude — 2026-04-17）

### P8: checksum フィールド追加

#### 型変更 (`src/types/archive.ts`)

```typescript
export interface MediaRecord {
  // ... 既存フィールド ...
  checksum: string | null;   // SHA-256 hex string, null if not computed
}
```

#### DB schema 変更 (`src/db/archive-db.ts`)

`checksum` は検索対象にならないためインデックス不要。schema version up と空の upgrade ハンドラを追加する（新規フィールドは自動的に `undefined` / `null` で既存レコードに追加される）。

#### OPFS 書き込み時に計算 (`src/features/archive/opfs-service.ts`)

```typescript
async function writeBlobToOpfs(blob: Blob, path: string): Promise<string | null> {
  // blob を ArrayBuffer に変換して SHA-256 を計算
  const buffer = await blob.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const checksum = Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
  
  // 既存の OPFS 書き込み処理 ...
  await writeToOpfs(path, blob);
  
  return checksum;
}
```

`writeBlobToOpfs()` の戻り値を `checksum: string | null` に変更し、`MediaRecord` 保存時に渡す。

### P9: OPFS クォータ超過の graceful handling

#### エラー分類

```typescript
function isQuotaExceededError(error: unknown): boolean {
  return error instanceof DOMException && 
    (error.name === "QuotaExceededError" || error.code === 22);
}
```

#### background → viewer へのメッセージ追加

クォータ超過時に `storage/quota-exceeded` メッセージを viewer に送信し、設定画面にバナーを表示する（詳細な UI 実装は Out of Scope — メッセージ定義と送信のみ）。

```typescript
// background.ts または opfs-service.ts
if (isQuotaExceededError(error)) {
  logger.warn("opfs.quota.exceeded", { context: { path } });
  // viewer へ通知（viewer が開いていれば）
  chrome.runtime.sendMessage({ type: "storage/quota-exceeded" }).catch(() => {});
}
```

---

### Sequencing

1. **P9** — エラー分類関数追加 + クォータ超過ログ改善（schema 変更なし、安全）
2. **P8** — `MediaRecord` 型に `checksum` 追加 + schema version up + `writeBlobToOpfs()` 変更
3. `npm run typecheck` / `npm run build`

---

## In Scope

- `src/types/archive.ts` — `MediaRecord.checksum` 追加
- `src/db/archive-db.ts` — schema version up（checksum は indexed なし）
- `src/features/archive/opfs-service.ts` — SHA-256 計算 + エラー分類
- ログ出力の改善（quota exceeded を warn レベルで区別）

## Out of Scope

- viewer 側のクォータ警告 UI（メッセージ定義と送信のみ）
- 既存 MediaRecord へのバックフィル（checksum nullable のまま）
- エクスポート/インポート機能（将来タスク）

## Work Log

（Codex が実装時に追記すること）

## Result

（Codex が記入）

## Verification

- [ ] `MediaRecord.checksum` フィールドが存在する（nullable）
- [ ] 新規保存メディアに checksum が設定される
- [ ] OPFS クォータ超過時のログレベルが `warn` になっている
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
