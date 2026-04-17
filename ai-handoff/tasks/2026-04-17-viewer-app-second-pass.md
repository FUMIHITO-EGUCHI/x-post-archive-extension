# Task Packet: ViewerApp 二次分解（メタデータ hook + フォーマッター分離）

## Meta
- status: active
- owner: Codex
- branch: feature/full-codebase-review-2026-04-14-fixes
- priority: low
- files_in_scope: src/features/viewer/components/viewer-app.tsx, src/features/viewer/components/
- blocked_by: none
- related_findings: 2026-04-17-cia-perf-audit
- needs_from_claude: none
- handoff_to_codex: design complete (2026-04-17); implement per design section below
- summary: viewer-app.tsx は 990 行まで縮小済み。残存する archive metadata 状態とピュア関数群を抽出して ~700 行台まで下げる

## Goal

`viewer-app.tsx` から、残存する 2 つの独立した責務を抽出する。

1. **`useArchiveMetadata` hook** — `availableTags` / `archiveSummary` / `userSummaries` 状態と `refreshArchiveMetadata()` を所有する
2. **`viewer-formatters.ts`** — React に依存しないピュア書式変換関数をすべて移動する

行動原則: データロード・フィルタ動作・viewer UI の振る舞いを変えない。

## Problem Statement

### 残存している責務（現 viewer-app.tsx）

`useArchiveMetadata` 候補（lines 57-69, 370-388）:
```typescript
// state (ViewerApp のトップ)
const [availableTags, setAvailableTags] = useState<ArchiveTagSummaryRecord[]>([]);
const [archiveSummary, setArchiveSummary] = useState<ArchiveSummaryRecord>({...});
const [userSummaries, setUserSummaries] = useState<UserSummary[]>([]);

// function
async function refreshArchiveMetadata(): Promise<void> {
  const [summaryResponse, tagsResponse, usersResponse] = await Promise.all([
    requestArchiveSummary(),
    requestTagSummaries(),
    requestUserSummaries()
  ]);
  setArchiveSummary(summaryResponse.summary);
  setAvailableTags(tagsResponse.tags);
  setUserSummaries(usersResponse.users);
}
```

`viewer-formatters.ts` 候補（lines 811-988、全 178 行のピュア関数）:
- `formatCount(value, language)` 
- `formatUserSummaryLabel(user)`
- `normalizeDateInputValue(value)`
- `parseLocalDateInput(value)` （`normalizeDateInputValue` に依存）
- `formatDateFilterTargetLabel(target, language)`
- `formatDateInputLabel(value, language)` （`parseLocalDateInput` に依存）
- `formatDateFilterConditionLabel(target, dateFrom, dateTo, language)` （上記に依存）
- `formatEmptyArchiveMessage(input)` （複数の上記関数に依存）
- `formatArchiveCountLabel(loadedCount, totalCount, hasMorePosts, language)` （`formatCount` に依存）

これらはすべて React state・hook に依存せず、引数だけで完結する。

## Design（Claude — 2026-04-17）

### 1. `use-archive-metadata.ts`

新規ファイル: `src/features/viewer/components/use-archive-metadata.ts`

```typescript
import { useState } from "react";
import {
  requestArchiveSummary,
  requestTagSummaries,
  requestUserSummaries
} from "../../runtime/client";
import { createLogger } from "../../logging/logger";
import type { ArchiveSummaryRecord, ArchiveTagSummaryRecord, UserSummary } from "../../../types/viewer";

const logger = createLogger("viewer");

export function useArchiveMetadata() {
  const [availableTags, setAvailableTags] = useState<ArchiveTagSummaryRecord[]>([]);
  const [archiveSummary, setArchiveSummary] = useState<ArchiveSummaryRecord>({
    postCount: 0,
    imageCount: 0,
    videoCount: 0,
    mediaCount: 0,
    accountCount: 0,
    tagCount: 0,
    mediaBytes: 0
  });
  const [userSummaries, setUserSummaries] = useState<UserSummary[]>([]);

  async function refreshArchiveMetadata(): Promise<void> {
    try {
      const [summaryResponse, tagsResponse, usersResponse] = await Promise.all([
        requestArchiveSummary(),
        requestTagSummaries(),
        requestUserSummaries()
      ]);
      setArchiveSummary(summaryResponse.summary);
      setAvailableTags(tagsResponse.tags);
      setUserSummaries(usersResponse.users);
    } catch (error) {
      logger.error("archive.metadata.load.failed", {
        message: "Failed to load archive metadata.",
        context: { error }
      });
    }
  }

  return {
    availableTags,
    archiveSummary,
    userSummaries,
    refreshArchiveMetadata
  };
}
```

**ViewerApp 側の変更:**

```typescript
// Before
const [availableTags, setAvailableTags] = useState<ArchiveTagSummaryRecord[]>([]);
const [archiveSummary, setArchiveSummary] = useState<ArchiveSummaryRecord>({...});
const [userSummaries, setUserSummaries] = useState<UserSummary[]>([]);
...
async function refreshArchiveMetadata() { ... }

// After
const archiveMetadata = useArchiveMetadata();
const { availableTags, archiveSummary, userSummaries, refreshArchiveMetadata } = archiveMetadata;
```

注意点:
- `refreshArchiveMetadata` の try/catch とログ出力は hook 内に移動する
- `useViewerPreferences` は `archiveSummary.mediaBytes` と `archiveSummary.postCount` を受け取っている → `archiveMetadata.archiveSummary.mediaBytes` / `archiveMetadata.archiveSummary.postCount` を渡す（既存の渡し方と変わらない）

---

### 2. `viewer-formatters.ts`

新規ファイル: `src/features/viewer/components/viewer-formatters.ts`

移動する関数（全てピュア、viewer-app.tsx lines 811-988）:
- `formatCount`
- `formatUserSummaryLabel`
- `normalizeDateInputValue`
- `parseLocalDateInput`
- `formatDateFilterTargetLabel`
- `formatDateInputLabel`
- `formatDateFilterConditionLabel`
- `formatEmptyArchiveMessage`
- `formatArchiveCountLabel`

`viewer-app.tsx` からの import 追加:
```typescript
import {
  formatCount,
  formatUserSummaryLabel,
  normalizeDateInputValue,
  formatEmptyArchiveMessage,
  formatArchiveCountLabel
} from "./viewer-formatters";
```

`use-filter-modal.ts` が `normalizeDateInputValue` や `parseLocalDateInput` を使用している場合は、そちらも同じ import に変更する。

注意: `formatUserSummaryLabel` は現在 viewer-app.tsx の中で `useFilterModal` の `getTagDisplayName` 引数に渡す `userSummaries` の表示生成に使われている可能性がある。grep で確認すること。

---

### Sequencing（順番）

1. **`viewer-formatters.ts` 抽出** — React 依存なし、安全。先に行う。
2. **`use-archive-metadata.ts` 抽出** — state 移動。`viewer-formatters.ts` 抽出後に行う。

各ステップで `npm run typecheck` と `npm run build` を通すこと。

---

### viewer-app.tsx after extraction（推定）

| セクション | 現行 | 抽出後 |
|---|---|---|
| imports + 定数 | ~55 行 | ~58 行（import 追加） |
| hook 呼び出し + 分割代入 | ~170 行 | ~145 行（metadata hook 1行化） |
| effects + local functions | ~250 行 | ~240 行（refreshArchiveMetadata 削除） |
| JSX render | ~260 行 | ~260 行（変化なし） |
| pure utility functions | ~178 行 | **0 行**（viewer-formatters.ts へ） |
| **合計** | **~990 行** | **~720 行** |

---

## In Scope

- `src/features/viewer/components/use-archive-metadata.ts` 新規作成
- `src/features/viewer/components/viewer-formatters.ts` 新規作成
- `viewer-app.tsx` から上記を使う形にリファクタ（動作変更なし）
- `use-filter-modal.ts` など既存の hook が `normalizeDateInputValue` 等を使っている場合は import 先を変更

## Out of Scope

- データロード・フィルタ・ソート動作の変更
- DB クエリの変更（パフォーマンス改善は別タスク）
- `getTagDisplayName` の抽出（`language` に閉じているためスコープ外）
- `initializeViewer` useEffect の抽出

## Work Log

- `2026-04-17 Codex`: Extracted pure formatter/date helpers from `viewer-app.tsx` into `viewer-formatters.ts`, and reused shared date helpers from `use-filter-modal.ts`.
- `2026-04-17 Codex`: Extracted archive metadata state and `refreshArchiveMetadata()` from `viewer-app.tsx` into `use-archive-metadata.ts`.

## Result

- `viewer-app.tsx` no longer owns archive summary/tag/user summary state directly.
- `viewer-app.tsx` no longer contains the pure formatter/date helper block.
- `use-filter-modal.ts` now shares `normalizeDateInputValue()` and `parseLocalDateInput()` from `viewer-formatters.ts`.
- Viewer behavior, data loading, filter/sort behavior, and settings/refetch wiring remain unchanged.

## Verification

- [x] `npm run typecheck` pass after formatter and metadata extraction.
- [x] `npm run build` pass after formatter and metadata extraction.

## Completion Checklist
- [x] investigation finished
- [x] implementation finished
- [x] `npm run typecheck`
- [x] `npm run build`
- [x] task packet `Result` updated
- [x] task packet `Verification` updated
- [x] `ai-handoff/current-task.md` updated
