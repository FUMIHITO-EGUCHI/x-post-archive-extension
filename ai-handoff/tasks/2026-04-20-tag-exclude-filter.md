# Task Packet: タグ除外フィルター

## Meta
- status: active
- owner: Codex
- branch: master
- priority: medium
- files_in_scope: src/types/viewer.ts, src/features/archive/archive-service.ts, src/features/viewer/components/use-archive-loader.ts, src/features/viewer/components/use-sort-filter.ts, src/features/viewer/components/unified-filter-modal.tsx, src/features/viewer/components/viewer-app.tsx, src/features/viewer/viewer-session-storage.ts, src/features/viewer/components/use-viewer-session.ts, src/features/runtime/client.ts
- blocked_by: none
- related_findings: none
- needs_from_claude: none
- handoff_to_codex: 設計完了。下記 Design 参照
- summary:

## Goal

フィルターモーダルのタグ一覧に「除外」機能を追加する。  
ユーザーはタグを「絞り込み（include）」か「除外（exclude）」かで適用でき、  
例として `bookmarked` タグを除外することでいいねのみ表示できるようになる。

## Design

### 概要

現在のタグフィルターは include のみ。各タグ行に include / exclude の 2 択ボタンを追加する。  
`excludeTagFilter` を `tagFilter` と対称の形でスタック全層に追加し、  
クエリ層では差集合で除外する。

### 変更一覧

#### 1. `src/types/viewer.ts`

`ListPostsPageInput` に `excludeTagFilter` 追加:
```ts
export type ListPostsPageInput = {
  // ... existing fields ...
  tagFilter: string | null;
  excludeTagFilter: string | null;   // NEW
  authorFilter: string | null;
  // ...
};
```

`PostFilterInput` に同フィールド追加:
```ts
export type PostFilterInput = Pick<
  ListPostsPageInput,
  "tagFilter" | "excludeTagFilter" | "authorFilter" | "dateFilterTarget" | "dateFrom" | "dateTo"
>;
```

`ViewerSessionState` に `activeExcludeTagFilter` 追加（optional、既存セッションとの互換維持）:
```ts
export type ViewerSessionState = {
  version: 1;
  // ... existing ...
  activeTagFilter: string | null;
  activeExcludeTagFilter?: string | null;   // NEW
  // ...
};
```

#### 2. `src/features/archive/archive-service.ts` — `resolveFilteredPostIds`

現在の実装（抜粋）:
```ts
async function resolveFilteredPostIds(input: ListPostsPageInput): Promise<Set<string> | null> {
  const tagFilterPostIds =
    input.tagFilter === null ? null : new Set(await listPostIdsByNormalizedName(input.tagFilter));
  // ...
  if (tagFilterPostIds === null && authorFilter === null && dateFilterPostIds === null) {
    return null;
  }
  const filterSets = [tagFilterPostIds, authorFilterPostIds, dateFilterPostIds].filter(
    (value): value is Set<string> => value !== null
  );
  const intersection = new Set<string>(filterSets[0]);
  for (const postId of intersection) {
    if (!filterSets.slice(1).every((set) => set.has(postId))) {
      intersection.delete(postId);
    }
  }
  return intersection;
}
```

変更後:
```ts
async function resolveFilteredPostIds(input: ListPostsPageInput): Promise<Set<string> | null> {
  const tagFilterPostIds =
    input.tagFilter === null ? null : new Set(await listPostIdsByNormalizedName(input.tagFilter));
  const excludeTagPostIds =                                                    // NEW
    input.excludeTagFilter === null                                             // NEW
      ? null                                                                    // NEW
      : new Set(await listPostIdsByNormalizedName(input.excludeTagFilter));     // NEW
  const authorFilter = normalizeAuthorFilter(input.authorFilter);
  const dateFilterTarget = normalizeDateFilterTarget(input.dateFilterTarget);
  const dateFrom = normalizeDateFilterTimestamp(input.dateFrom);
  const dateTo = normalizeDateFilterTimestamp(input.dateTo);
  const dateFilterPostIds = /* unchanged */ ...;

  if (
    tagFilterPostIds === null &&
    excludeTagPostIds === null &&                // NEW condition
    authorFilter === null &&
    dateFilterPostIds === null
  ) {
    return null;
  }

  const authorFilterPostIds =
    authorFilter === null ? null : new Set(await listPostIdsByAuthorFilter(authorFilter));

  const filterSets = [tagFilterPostIds, authorFilterPostIds, dateFilterPostIds].filter(
    (value): value is Set<string> => value !== null
  );

  let result: Set<string>;
  if (filterSets.length === 0) {
    // excludeTagFilter only → start from all IDs           // NEW branch
    result = new Set(await listPostIds());                   // NEW
  } else {
    result = new Set<string>(filterSets[0]);
    for (const postId of result) {
      if (!filterSets.slice(1).every((set) => set.has(postId))) {
        result.delete(postId);
      }
    }
  }

  // Apply exclude                        // NEW
  if (excludeTagPostIds !== null) {        // NEW
    for (const postId of excludeTagPostIds) { // NEW
      result.delete(postId);               // NEW
    }                                      // NEW
  }                                        // NEW

  return result;
}
```

注意: `excludeTagFilter` のみのケースでは `listPostIds()` を呼ぶ（全 ID フェッチ）。  
投稿数が多い環境では遅くなりうるが、既存フィルター処理と同等のコスト感。

#### 3. `src/features/viewer/components/use-archive-loader.ts`

`LoadArchivePageInput` に追加:
```ts
export type LoadArchivePageInput = {
  // ... existing ...
  tagFilter: string | null;
  excludeTagFilter: string | null;   // NEW
  // ...
};
```

`loadArchivePage` 内の `requestPostsPage` 呼び出しに `excludeTagFilter: input.excludeTagFilter` を渡す。

#### 4. `src/features/viewer/components/use-sort-filter.ts`

```ts
const [activeExcludeTagFilter, setActiveExcludeTagFilter] = useState<string | null>(null);
```

`getCurrentPostFilterInput` に追加:
```ts
function getCurrentPostFilterInput(): PostFilterInput {
  return {
    tagFilter: activeTagFilter,
    excludeTagFilter: activeExcludeTagFilter,   // NEW
    authorFilter: activeAuthorFilter,
    // ...
  };
}
```

`handleToggleExcludeTagFilter` を追加:
```ts
async function handleToggleExcludeTagFilter(normalizedName: string) {
  const nextValue = activeExcludeTagFilter === normalizedName ? null : normalizedName;
  // include と同じタグを exclude にしようとした場合、include を解除する
  const nextTagFilter = nextValue !== null && activeTagFilter === normalizedName
    ? null
    : activeTagFilter;

  setActiveExcludeTagFilter(nextValue);
  if (nextTagFilter !== activeTagFilter) setActiveTagFilter(nextTagFilter);
  closeFilterModal();
  window.scrollTo({ top: 0 });
  await loadArchivePage({
    offset: 0,
    limit: DEFAULT_PAGE_SIZE,
    sortField,
    sortDirection,
    ...getRandomSeedInput(),
    tagFilter: nextTagFilter,
    excludeTagFilter: nextValue,
    authorFilter: activeAuthorFilter,
    ...getCurrentDateFilterInput(),
    append: false
  });
}
```

既存の `handleToggleTagFilter` も同様に、include をセットする際に exclude が同タグなら解除する:
```ts
async function handleToggleTagFilter(normalizedName: string) {
  const nextValue = activeTagFilter === normalizedName ? null : normalizedName;
  const nextExcludeValue = nextValue !== null && activeExcludeTagFilter === normalizedName
    ? null
    : activeExcludeTagFilter;

  setActiveTagFilter(nextValue);
  if (nextExcludeValue !== activeExcludeTagFilter) setActiveExcludeTagFilter(nextExcludeValue);
  // ... rest unchanged, pass excludeTagFilter: nextExcludeValue to loadArchivePage ...
}
```

`handleClearAllFilters` に `setActiveExcludeTagFilter(null)` と `excludeTagFilter: null` 追加。

すべての `loadArchivePage` 呼び出しに `excludeTagFilter: activeExcludeTagFilter`（または `null`）を渡す。

戻り値に `activeExcludeTagFilter`, `setActiveExcludeTagFilter`, `handleToggleExcludeTagFilter` を追加。

#### 5. `src/features/runtime/client.ts`

`requestPostsPage` の引数型が `ListPostsPageInput` ベースなら自動的に `excludeTagFilter` が通る。  
`ListPostsPageInput` に追加した時点で型エラーがあれば修正する。

#### 6. `src/features/viewer/components/unified-filter-modal.tsx`

`UnifiedFilterModalProps` に追加:
```ts
activeExcludeTagFilter: string | null;
selectedExcludeTagFilter: ArchiveTagSummaryRecord | null;
onToggleExcludeTagFilter: (normalizedName: string) => void;
```

`tabOptions` の tag タブ `isActive` 変更:
```ts
{
  tab: "tag" as const,
  label: language === "ja" ? "タグ" : "Tag",
  isActive: activeTagFilter !== null || activeExcludeTagFilter !== null   // changed
}
```

`TagFilterPanel` の props に `activeExcludeTagFilter`, `selectedExcludeTagFilter`, `onToggleExcludeTagFilter` 追加。

**タグ行の UI 変更**（`TagFilterPanel` 内）:

現在: 1 ボタン（クリックで include toggle）  
変更後: 2 ボタン行

```tsx
{displayedTagOptions.map(({ tag, postCount }) => {
  const isIncluded = tag.normalized_name === activeTagFilter;
  const isExcluded = tag.normalized_name === activeExcludeTagFilter;
  return (
    <div key={tag.tag_id} className="viewer-tag-option-row">
      <span className="viewer-tag-option-label">
        <strong>{getTagDisplayName(tag)}</strong>
        <span>
          {formatCount(postCount, language)} {language === "ja" ? "件" : "posts"}
        </span>
      </span>
      <button
        className={isIncluded ? "viewer-tag-option-btn viewer-tag-option-btn-active" : "viewer-tag-option-btn"}
        type="button"
        aria-pressed={isIncluded}
        onClick={() => onToggleTagFilter(tag.normalized_name)}
      >
        {language === "ja" ? "絞り込む" : "Include"}
      </button>
      <button
        className={isExcluded ? "viewer-tag-option-btn viewer-tag-option-btn-exclude viewer-tag-option-btn-active" : "viewer-tag-option-btn viewer-tag-option-btn-exclude"}
        type="button"
        aria-pressed={isExcluded}
        onClick={() => onToggleExcludeTagFilter(tag.normalized_name)}
      >
        {language === "ja" ? "除外" : "Exclude"}
      </button>
    </div>
  );
})}
```

exclude 適用中サマリー行を include サマリー行の下に追加:
```tsx
{selectedExcludeTagFilter !== null && (
  <div className="viewer-tag-modal-summary">
    <span>
      {language === "ja" ? "除外中" : "Excluded"}:{" "}
      {getTagDisplayName(selectedExcludeTagFilter.tag)}
    </span>
    <button
      className="viewer-tag-filter-clear"
      type="button"
      onClick={() => onToggleExcludeTagFilter(selectedExcludeTagFilter.tag.normalized_name)}
    >
      {language === "ja" ? "解除" : "Clear"}
    </button>
  </div>
)}
```

#### 7. `src/features/viewer/components/viewer-app.tsx`

`use-sort-filter` から `activeExcludeTagFilter`, `handleToggleExcludeTagFilter` を取り出し、  
`UnifiedFilterModal` に渡す。  
`selectedExcludeTagFilter` は `tagSummaries.find(s => s.tag.normalized_name === activeExcludeTagFilter) ?? null` で導出。  
StickyToolbar の `filterChips` 計算で `activeExcludeTagFilter !== null` の場合も `{ key: "tag" }` を含める。

#### 8. `src/features/viewer/viewer-session-storage.ts`

`isViewerSessionState` のバリデーターに追加（optional フィールドなので後方互換）:
```ts
(candidate.activeExcludeTagFilter === undefined ||
  candidate.activeExcludeTagFilter === null ||
  typeof candidate.activeExcludeTagFilter === "string") &&
```

#### 9. `src/features/viewer/components/use-viewer-session.ts`

セッション保存時: `activeExcludeTagFilter` を含める。  
セッション復元時: `activeExcludeTagFilter` を `setActiveExcludeTagFilter` に適用する。

### CSS クラス（新規 2 つ）

既存のタグ option スタイルを参考に追加:
- `.viewer-tag-option-row` — flex row、label + 2 buttons
- `.viewer-tag-option-btn` — 既存 `.viewer-tag-option` ベースで小さめに
- `.viewer-tag-option-btn-exclude` — exclude ボタン用（色違い、例: 赤系 or 薄いオレンジ）

スタイルは `src/entrypoints/viewer/viewer.css`（または既存の CSS ファイル）に追加。

### 制約・注意

- include と exclude に同じタグを設定しない（ハンドラ側で相互排他を保証する）
- `excludeTagFilter` のみ設定時は `listPostIds()` 全件取得が走る。パフォーマンス許容範囲内と想定するが、将来的には最適化余地あり
- セッション復元: `activeExcludeTagFilter` は optional なので `undefined` → `null` に正規化して適用する

## Acceptance Criteria

- [ ] タグタブの各タグ行に「絞り込む」「除外」ボタンが表示される
- [ ] 除外ボタンを押すと該当タグを持つ投稿が一覧から消える
- [ ] `bookmarked` タグを除外するといいね投稿のみが表示される
- [ ] include と exclude を同じタグに同時設定できない（一方をセットすると他方が解除される）
- [ ] 「すべての絞り込みを解除」で exclude も解除される
- [ ] フィルターモーダルのタグタブバッジが exclude 適用中でも表示される
- [ ] セッション復元で exclude フィルターが引き継がれる
- [ ] `npm run typecheck` pass
- [ ] `npm run build` pass

## Completion Checklist

- [ ] implementation finished
- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] task packet `Result` updated
- [ ] task packet `Verification` updated
- [ ] `ai-handoff/current-task.md` updated
- [ ] `npm run handoff:check`

## Work Log

- `2026-04-20 Claude`: 設計完了。task packet 作成。Codex へ handoff。

## Codex Result

(未記入)

## Verification

(未記入)
