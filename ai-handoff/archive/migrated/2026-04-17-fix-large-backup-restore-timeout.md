# Task Packet: Fix Large Backup Restore Timeout

## Meta
- status: active
- owner: Codex
- branch: fix/large-backup-restore-timeout
- priority: high
- files_in_scope: src/features/viewer/components/settings-archive-maintenance-panel.tsx, src/features/archive/archive-maintenance-service.ts, src/features/runtime/handle-runtime-message.ts, src/features/runtime/client.ts, src/types/runtime.ts
- blocked_by: none
- related_findings: none
- needs_from_claude: none
- handoff_to_codex: design complete (2026-04-17)
- summary: Move restore logic from background SW to viewer page to eliminate 10-minute timeout for large backups.

## Goal

15.6GB のバックアップを取り込もうとすると `"Runtime request timed out after 600000ms."` で失敗する。

### 根本原因（調査済み）

現在の復元フローは Background SW への 1回の `sendMessage` に依存している。

```
Viewer: staging書き込み(15.6GB) → sendMessage → [10分後タイムアウト]
                                                      ↑
Background:                              まだ処理中 → NotFoundError
```

1. Viewer が 10分 (`RESTORE_RUNTIME_TIMEOUT_MS = 600000`) でタイムアウト
2. catch ブロックが `cleanupRestoreStagingFile()` を実行して staging ファイルを削除
3. Background はまだ zip.js で staging ファイルを読んでおり、削除されて `NotFoundError`
4. さらに `clearArchiveData()` は復元完了前に実行済みのため、既存アーカイブが失われる

### 修正方針

**復元処理を Viewer ページで直接実行する**（Background を経由しない）。

- Viewer は通常タブ → SW ライフサイクル制限なし、タイムアウトなし
- `File` オブジェクトを直接 `importArchiveBackupZip(file, onProgress)` に渡せる
- staging ファイルへのコピー（15.6GB の OPFS 書き込み）が不要になる
- progress コールバックが正しく動く（現在は background 経由で progress が表示されない）

## In Scope

- `settings-archive-maintenance-panel.tsx`: `requestRestoreArchive` の代わりに `importArchiveBackupZip` を直接呼ぶ。staging 書き込み・クリーンアップを削除。
- `archive-maintenance-service.ts`: 変更不要（`importArchiveBackupZip` はそのまま使う）
- `handle-runtime-message.ts`: `archive/restore` ケースを削除
- `client.ts`: `requestRestoreArchive` 関数と `RESTORE_RUNTIME_TIMEOUT_MS` 定数を削除
- `types/runtime.ts`: `RestoreArchiveMessage`・`RestoreArchiveResponse` 型を削除し、`RuntimeMessage` / `RuntimeResponse` の union からも除去

## Out Of Scope

- staging ファイルをストリーミング処理する方式（不要になるため）
- 復元中の refetch との排他制御（既存と同レベルのまま）
- バックアップサイズ上限の追加（今回は対象外）

## 変更設計

### `settings-archive-maintenance-panel.tsx`

`handleRestore()` を以下のように書き換える:

**変更前の流れ（削除する処理）:**
```ts
const restoreFile = await readRestoreFileWithRetry(restoreHandle, language);
await writeRestoreStagingFile(restoreFile);               // ← 削除
await requestRestoreArchive("restore-staging/backup.zip"); // ← 削除
```

**変更後の流れ:**
```ts
const restoreFile = await readRestoreFileWithRetry(restoreHandle, language);
const summary = await importArchiveBackupZip(restoreFile, (progress) => {
  setRestoreProgress(progress);
});
await onArchiveChanged();
// summary を使って setRestoreStatus を更新
```

- `writeRestoreStagingFile` / `cleanupRestoreStagingFile` / `stagingPath` 変数を削除
- `requestRestoreArchive` の import を削除
- `importArchiveBackupZip` を `archive-maintenance-service` から import する
- `setRestoreStatus("バックアップを準備中...")` / `"バックグラウンドで復元中..."` のメッセージを削除（progress カードで十分）
- catch ブロックから `cleanupRestoreStagingFile(stagingPath)` の呼び出しを削除

### `types/runtime.ts`

- `RestoreArchiveMessage` 型を削除
- `RestoreArchiveResponse` 型を削除
- `RuntimeMessage` union から `RestoreArchiveMessage` を除去
- `RuntimeResponse` union から `RestoreArchiveResponse` を除去

### `client.ts`

- `requestRestoreArchive` 関数を削除
- `RESTORE_RUNTIME_TIMEOUT_MS` 定数を削除
- `RestoreArchiveResponse` の import を削除

### `handle-runtime-message.ts`

- `case "archive/restore":` ブロック全体を削除
- `importArchiveBackupZip` の import を削除（`resetExtensionState` は残す）
- `RestoreArchiveResponse` の import を削除
- `isRuntimeMessage()` から `candidate.type === "archive/restore"` を除去

## Work Log

- `2026-04-17 Claude`: 調査完了。根本原因は Viewer 側 10分タイムアウトと staging 競合削除。設計完了。
- `2026-04-17 Codex`: `handleRestore()` を Viewer 直接復元に変更し、Background の `archive/restore` runtime message と staging helper を削除。`npm run typecheck` / `npm run build` pass。

## Result

Viewer の復元フローは、選択した `File` を `importArchiveBackupZip(file, onProgress)` に直接渡す形になった。

- `settings-archive-maintenance-panel.tsx`: OPFS staging 書き込み、staging cleanup、`requestRestoreArchive` 呼び出しを削除。復元 progress は `importArchiveBackupZip` の callback で更新。
- `client.ts`: `requestRestoreArchive` と `RESTORE_RUNTIME_TIMEOUT_MS` を削除。
- `handle-runtime-message.ts`: `archive/restore` handler と message validator の許可を削除。
- `types/runtime.ts`: `RestoreArchiveMessage` / `RestoreArchiveResponse` と union 参照を削除。

## Verification

- [ ] 15.6GB に近い大きなバックアップが復元できる（実機確認）
- [ ] 復元中に progress バーが更新される（実機確認）
- [x] `archive/restore` メッセージ型が types/runtime.ts から消えている
- [x] `requestRestoreArchive` が client.ts から消えている
- [x] `npm run typecheck` pass
- [x] `npm run build` pass

## Completion Checklist
- [x] investigation finished
- [x] implementation finished
- [x] `npm run typecheck`
- [x] `npm run build`
- [x] task packet `Result` updated
- [x] task packet `Verification` updated
- [x] `ai-handoff/current-task.md` updated
