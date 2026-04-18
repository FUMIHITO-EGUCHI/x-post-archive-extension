# Task Packet: バックアップ復元時にマージ／置き換えを選択可能にする

## Meta
- status: done
- owner: Codex
- branch: master
- priority: normal
- files_in_scope: src/features/archive/archive-maintenance-service.ts, src/features/viewer/components/settings-archive-maintenance-panel.tsx
- blocked_by: none
- related_findings: none
- needs_from_claude: none
- handoff_to_codex: 設計は下記参照。実装前に archive-maintenance-service.ts の importArchiveBackupZip 全体を読むこと
- summary:

## Goal

バックアップ ZIP から復元するとき、現在の「完全置き換え」に加えて「マージ（既存データに追加）」モードを選べるようにする。

## Problem Statement

現在の `importArchiveBackupZip`（archive-maintenance-service.ts:171）は復元前に `clearArchiveData()` を呼び出し、既存のアーカイブをすべて削除してから ZIP の内容を書き込む（置き換えモードのみ）。

マージモードでは既存データを消さずに ZIP の投稿・メディア・タグを追加する。重複は「既存優先」で無視する（上書きしない）。

## Design

### 1. `importArchiveBackupZip` に `mode` オプションを追加

```typescript
export type RestoreMode = "replace" | "merge";

export async function importArchiveBackupZip(
  file: Blob,
  options?: {
    mode?: RestoreMode;
    onProgress?: (progress: ArchiveTransferProgress) => void;
  }
): Promise<ArchiveBackupSummary>
```

後方互換のため `onProgress` を `options` に移すか、オーバーロードで現行シグネチャを維持するかを Codex が判断すること（呼び出し元は `settings-archive-maintenance-panel.tsx` のみ）。

### 2. `mode === "replace"` の場合（現行動作）

`clearArchiveData()` → ファイル書き込み → DB インポート（変更なし）

### 3. `mode === "merge"` の場合

`clearArchiveData()` を **呼ばない**。

ZIP 内の各エントリを既存データと比較して追加のみ行う:
- **メディアファイル（OPFS）**: `opfs_path` が既存に存在する場合はスキップ
- **posts**: `archiveDb.posts.put()` の代わりに `archiveDb.posts.add()` + 重複エラー無視（Dexie の `bulkAdd` with `allSettled` または `put` ではなく `add`）
- **post_tags**: 既存と同一の `[x_post_id+normalized_name]` はスキップ（`addPostTag` の重複検出ロジック流用）
- **tags**: `normalized_name` が一致する既存タグがあればスキップ

インポート関数内で `mode` を分岐させるだけでよい。DB スキーマ変更は不要。

### 4. UI（settings-archive-maintenance-panel.tsx）

復元セクション（約 376–428 行目）に radio または select で「モード選択」を追加する:

```tsx
// 状態追加
const [restoreMode, setRestoreMode] = useState<RestoreMode>("replace");

// ラジオボタン（ファイル選択ボタンの上に追加）
<div>
  <label>
    <input type="radio" value="replace" checked={restoreMode === "replace"}
      onChange={() => setRestoreMode("replace")} />
    {isJapanese ? "置き換え（現在のアーカイブを削除して復元）" : "Replace (clear current archive and restore)"}
  </label>
  <label>
    <input type="radio" value="merge" checked={restoreMode === "merge"}
      onChange={() => setRestoreMode("merge")} />
    {isJapanese ? "マージ（既存データに追加）" : "Merge (add to existing archive)"}
  </label>
</div>
```

`handleRestore` 内で `importArchiveBackupZip(restoreFile, { mode: restoreMode, onProgress: ... })` に変更する。

置き換えモードの confirm ダイアログ文言は現行のまま。マージモードでは confirm を出さない（破壊的操作でないため）。

## In Scope

- `src/features/archive/archive-maintenance-service.ts` — `importArchiveBackupZip` に `mode` 分岐を追加
- `src/features/viewer/components/settings-archive-maintenance-panel.tsx` — モード選択 UI と `handleRestore` の更新

## Out Of Scope

- バックアップ ZIP フォーマット自体の変更
- マージ競合時の「どちらを優先するか」設定（既存データ優先で固定）
- タグリダイレクト (`tag_redirects`) テーブルのマージ（スコープ外、将来タスク）

## Constraints

- 既存の「置き換え」動作を壊さない
- マージ後に `onArchiveChanged()` を呼び出してサマリーを更新すること
- `RestoreMode` 型は `src/types/` または service ファイル内に定義してよい（小さいので service 内でもOK）

## Files To Read First

- `src/features/archive/archive-maintenance-service.ts`（全体）
- `src/features/viewer/components/settings-archive-maintenance-panel.tsx`（全体）
- `src/db/repositories/posts-repository.ts`（bulkAdd / put の API 確認）
- `src/db/repositories/tags-repository.ts`（タグの重複回避 API 確認）

## Acceptance Criteria

- [ ] 「置き換え」モードで復元すると既存データが消えて ZIP の内容に差し替わる（現行動作と同一）
- [ ] 「マージ」モードで復元すると既存データが残り ZIP の投稿・メディア・タグが追加される
- [ ] マージ時に重複する投稿・タグは上書きされない
- [ ] `npm run typecheck` pass
- [ ] `npm run build` pass

## Open Questions

- `importArchiveBackupZip` の現行シグネチャを壊す場合、他に呼び出し元はないか（grep で確認すること）
- tags テーブルのマージ（`normalized_name` 重複時の動作）は tags-repository の既存 API で対応できるか

## Work Log

- `2026-04-18 Claude`: task packet 作成。clearArchiveData() の有無でモード分岐する設計を策定

## Codex Plan
- `importArchiveBackupZip` に `replace` / `merge` モードを追加する。
- `replace` は既存の削除後 `bulkPut` 動作を維持する。
- `merge` は OPFS ファイル、posts、media、tags、tag_redirects、post_tags の重複を既存優先でスキップする。
- 設定画面に復元モード選択を追加し、置き換え時だけ確認ダイアログを出す。
- `npm run typecheck` と `npm run build` で確認する。

## Codex Result
バックアップ復元に `replace` / `merge` モードを追加した。`replace` は従来通り現在のアーカイブを削除して復元し、`merge` は既存データを保持して ZIP 内の未登録データだけ追加する。タグは `normalized_name` が既存と一致する場合、既存タグIDに寄せて `post_tags` を追加する。設定画面には復元モード選択を追加し、破壊的な確認ダイアログは置き換えモードのみに限定した。

## Changed Files
- `src/features/archive/archive-maintenance-service.ts`
- `src/features/viewer/components/settings-archive-maintenance-panel.tsx`

## Verification
- `npm run typecheck` passed
- `npm run build` passed

## Remaining Issues
none

## Suggested Next Action
Manual verify with a small backup ZIP: replace clears current data, merge preserves existing duplicate posts/tags and adds only missing records.

## Completion Checklist
- [x] implementation finished
- [x] `npm run typecheck`
- [x] `npm run build`
- [x] task packet `Codex Result` or `Result` updated
- [x] task packet `Verification` updated
- [x] `ai-handoff/current-task.md` updated
- [x] `npm run handoff:check`
