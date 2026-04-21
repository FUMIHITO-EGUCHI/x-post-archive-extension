# Task Packet: Keyword Search

## Meta
- status: active
- owner: Codex
- branch: feature/keyword-search
- priority: medium
- files_in_scope: src/types/viewer.ts, src/db/repositories/posts-repository.ts, src/features/archive/archive-service.ts, src/features/viewer/components/use-archive-loader.ts, src/features/viewer/components/use-sort-filter.ts, src/features/viewer/components/sticky-toolbar.tsx, src/features/viewer/components/viewer-app.tsx, src/entrypoints/viewer/style.css
- blocked_by: none
- related_findings: none
- needs_from_claude: none
- handoff_to_codex: ready
- summary: Add keyword search to the viewer header. A magnifying glass button expands the toolbar into a full-width text input that filters posts by post_text substring match.

## Goal

1. Add a magnifying glass button to the right of the filter button in the sticky toolbar.
2. When clicked, replace the entire toolbar with a full-width text input + ✕ close button.
3. Typing filters `post_text` with a case-insensitive substring match (300ms debounce).
4. Keyword filter is AND-combined with existing tag / author / date filters.
5. ✕ button or ESC key closes search mode and clears the keyword filter.

## UX Spec

- **Normal mode**: 絞り込み | 一括タグ付け | 🔍 ← new button | [center area] | count | sort | ⚙
- **Search mode**: `[🔍 icon] [text input ─────────────────────] [✕]`
  - autoFocus on input when entering search mode
  - ESC key: close search mode
  - Empty input: keyword filter is null (no filtering)
  - Closing clears keyword filter and reloads archive

## Implementation Plan

### Step 1 — Type: `src/types/viewer.ts`

Add `keywordFilter: string | null` to `ListPostsPageInput`.

Update `PostFilterInput` Pick to include `"keywordFilter"`.

### Step 2 — Repository: `src/db/repositories/posts-repository.ts`

Add:

```typescript
export async function listPostIdsByKeyword(keyword: string): Promise<string[]> {
  const lower = keyword.toLowerCase();
  return (
    await archiveDb.posts
      .filter((post) => post.post_text.toLowerCase().includes(lower))
      .primaryKeys()
  ).map(String);
}
```

### Step 3 — Service: `src/features/archive/archive-service.ts`

Import `listPostIdsByKeyword`.

In `resolveFilteredPostIds`, add keyword filter set (same pattern as existing filters):

```typescript
const keyword = normalizeKeywordFilter(input.keywordFilter);
const keywordFilterPostIds =
  keyword === null ? null : new Set(await listPostIdsByKeyword(keyword));
```

Add `keywordFilterPostIds` to the null-check guard and to `filterSets`.

Add helper:

```typescript
function normalizeKeywordFilter(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}
```

### Step 4 — use-archive-loader: `src/features/viewer/components/use-archive-loader.ts`

Add `keywordFilter: string | null` to `LoadArchivePageInput`.

Pass it through to `requestPostsPage`.

### Step 5 — use-sort-filter: `src/features/viewer/components/use-sort-filter.ts`

Add state:

```typescript
const [activeKeywordFilter, setActiveKeywordFilter] = useState<string | null>(null);
```

Add `keywordFilter: activeKeywordFilter` to every `loadArchivePage(...)` call and to `getCurrentPostFilterInput()`.

Reset keyword in `clearAllFilters`.

Expose `handleKeywordChange` (sets state + calls loadArchivePage with reset offset):

```typescript
async function handleKeywordChange(keyword: string | null): Promise<void> {
  setActiveKeywordFilter(keyword);
  await loadArchivePage({
    offset: 0,
    limit: PAGE_LIMIT,
    sortField: currentSortField,
    sortDirection: currentSortDirection,
    randomSeed: currentRandomSeed,
    tagFilter: activeTagFilter,
    excludeTagFilter: activeExcludeTagFilter,
    authorFilter: activeAuthorFilter,
    dateFilterTarget: activeDateFilterTarget,
    dateFrom: activeDateFrom,
    dateTo: activeDateTo,
    keywordFilter: keyword,
    append: false,
  });
}
```

Return `activeKeywordFilter`, `setActiveKeywordFilter`, `handleKeywordChange` from the hook.

### Step 6 — StickyToolbar: `src/features/viewer/components/sticky-toolbar.tsx`

Add props:

```typescript
isSearchMode: boolean;
keywordFilter: string | null;
onOpenSearch: () => void;
onCloseSearch: () => void;
onKeywordChange: (keyword: string | null) => void;
```

In **normal mode**, add magnifying glass button after the bulk-tag button (inside `.viewer-toolbar-left`):

```tsx
<button
  className="viewer-icon-button"
  type="button"
  aria-label={language === "ja" ? "キーワード検索" : "Keyword search"}
  onClick={onOpenSearch}
>
  <SearchIcon />
</button>
```

In **search mode**, replace the entire `<section>` content:

```tsx
if (isSearchMode) {
  return (
    <section className="viewer-sticky-toolbar viewer-sticky-toolbar-search" aria-label="...">
      <div className="viewer-search-container">
        <SearchIcon className="viewer-search-icon" />
        <input
          className="viewer-search-input"
          type="search"
          autoFocus
          placeholder={language === "ja" ? "キーワードで検索…" : "Search by keyword…"}
          defaultValue={keywordFilter ?? ""}
          onKeyDown={(e) => { if (e.key === "Escape") onCloseSearch(); }}
          onChange={/* debounced handler below */}
        />
        <button className="viewer-icon-button" type="button" onClick={onCloseSearch}
          aria-label={language === "ja" ? "検索を閉じる" : "Close search"}>
          <CloseIcon />
        </button>
      </div>
    </section>
  );
}
```

Debounce in the component using `useRef<number | null>(null)` + `window.setTimeout` / `window.clearTimeout` (300ms), same pattern as `use-viewer-session.ts:113`.

Add `SearchIcon` (magnifying glass, 24×24 SVG) and `CloseIcon` (✕, 24×24 SVG) functions at the bottom of the file.

### Step 7 — viewer-app.tsx: `src/features/viewer/components/viewer-app.tsx`

Add state:

```typescript
const [isSearchMode, setIsSearchMode] = useState(false);
```

Pass to `StickyToolbar`:

```tsx
isSearchMode={isSearchMode}
keywordFilter={sortFilter.activeKeywordFilter}
onOpenSearch={() => setIsSearchMode(true)}
onCloseSearch={() => {
  setIsSearchMode(false);
  sortFilter.handleKeywordChange(null);
}}
onKeywordChange={(keyword) => sortFilter.handleKeywordChange(keyword)}
```

### Step 8 — CSS: `src/entrypoints/viewer/style.css`

Add after the `.viewer-sticky-toolbar` block:

```css
.viewer-sticky-toolbar-search {
  display: block;
}

.viewer-search-container {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.viewer-search-icon {
  flex-shrink: 0;
  color: var(--color-text-muted);
}

.viewer-search-input {
  flex: 1;
  min-width: 0;
  height: 36px;
  padding: 0 12px;
  font-size: 15px;
  border: 1.5px solid var(--color-accent);
  border-radius: 8px;
  background: var(--color-bg);
  color: var(--color-text);
  outline: none;
  appearance: none;
}

.viewer-search-input:focus {
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent) 20%, transparent);
}

.viewer-search-input::-webkit-search-cancel-button {
  display: none;
}
```

For dark mode, follow the pattern of `.viewer-sort-select` dark mode block (around line 2430).

## Acceptance Criteria

- [ ] Clicking the magnifying glass enters search mode; input is auto-focused
- [ ] Search mode shows only the search input and ✕ button across the full toolbar width
- [ ] Typing triggers a debounced (300ms) keyword search on `post_text`
- [ ] Case-insensitive substring match
- [ ] ✕ button closes search mode and clears the keyword filter
- [ ] ESC key closes search mode (same effect as ✕)
- [ ] Keyword filter AND-combines with active tag / author / date filters
- [ ] Clearing the input removes keyword filter (shows full results)
- [ ] `clearAllFilters` resets keyword filter and closes search mode
- [ ] Sort order changes while in search mode preserve the keyword filter
- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes

## Test Plan (human verification required before marking done)

### A. Functional tests

| # | Scenario | Expected |
|---|---|---|
| A-1 | Click magnifying glass | Search mode opens; input auto-focused; toolbar controls hidden |
| A-2 | Type keyword | After 300ms, results filter to posts whose `post_text` includes the keyword |
| A-3 | Clear input | All posts reload (keyword = null) |
| A-4 | Click ✕ | Search mode closes; keyword cleared; original list restored |
| A-5 | Press ESC | Same as A-4 |
| A-6 | Tag filter active, then type keyword | Results are AND of both filters |
| A-7 | Author filter active, then type keyword | Results are AND of both filters |
| A-8 | `clearAllFilters` while in search mode | Keyword cleared, search mode closed, all posts restored |
| A-9 | Mixed-case keyword ("Hello") | Matches posts containing "hello", "HELLO", "Hello", etc. |
| A-10 | Change sort order while in search mode | Sort changes but keyword filter is preserved |

### B. Build verification

```bash
npm run typecheck
npm run build
```

### C. Edge cases

| # | Case | Expected |
|---|---|---|
| C-1 | Keyword = spaces only ("   ") | Treated as null; no filtering |
| C-2 | Archive has 0 posts | No crash; 0 results displayed |
| C-3 | Keyword search + random sort | Keyword-filtered pool is shuffled randomly |
| C-4 | Filter modal button hidden in search mode | Cannot open filter modal while searching (by design) |

## Work Log

- `2026-04-21 Claude`: Task packet created. Design reviewed. Ready for Codex handoff.
