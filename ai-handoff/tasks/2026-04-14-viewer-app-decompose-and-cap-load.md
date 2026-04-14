# Task Packet: Decompose ViewerApp and Cap Session Restore Load

## Meta
- status: active
- owner: Codex
- branch: feature/full-codebase-review-2026-04-14-fixes
- priority: low
- files_in_scope: src/features/viewer/components/viewer-app.tsx, src/features/viewer/components/
- blocked_by: none
- related_findings: full-codebase-review-2026-04-14 P4-001, P4-002
- needs_from_claude: none
- handoff_to_codex: design complete (2026-04-14); implement decomposition per design section; start with initialLimit cap, then PostCard extraction
- summary: viewer-app.tsx is 2800+ lines with 40+ useState calls and no post-list virtualization; session restore can load unbounded counts

## Goal

Make `viewer-app.tsx` maintainable by extracting logical sub-components and custom hooks, and prevent unbounded memory use on session restore by capping `initialLimit`.

## Problem Statement

### P4-001 — God Component

`src/features/viewer/components/viewer-app.tsx` is ~2,800 lines with:
- 40+ `useState` calls at the component top
- Interleaved state for: post list, filter modal, tag sidebar, lightbox, refetch queue, settings panel, backup/restore, session persistence
- All post rendering in a single `.map()` at ~line 1610 with no virtualization
- Inline arrow handlers per post creating new function objects on every render: `onClick={() => void handleDelete(post.x_post_id)}`

This makes the file hard to navigate, diff, and reason about.

### P4-002 — Unbounded Session Restore

On session restore (~line 408):
```typescript
const initialLimit = Math.max(DEFAULT_PAGE_SIZE, savedSession.loadedCount);
```

If the user had scrolled to 1,000+ posts in a previous session, the next open immediately loads 1,000+ records from IndexedDB. There is no upper bound. Under a large archive this can cause a noticeable delay and high memory use on viewer open.

## Design (Claude — 2026-04-14)

### Guiding constraint

`loadArchivePage` is called with **explicit parameters** from every sort/filter/load-more handler. It is the single most-called internal function and the natural seam for splitting state. The decomposition strategy is:

1. Extract `loadArchivePage` + its owned state into `useArchiveLoader`.
2. Pass `useArchiveLoader.loadArchivePage` as a callback to `useSortFilter`.
3. Everything else (refetch, lightbox, preferences, session, tag ops, filter modal) is independently extractable.

---

### New files — all in `src/features/viewer/components/`

#### `use-archive-loader.ts`
Custom hook. Owns the post list and loading state.

**State:**
- `posts: ArchivePostRecord[]`
- `archiveTotalCount: number`
- `hasMorePosts: boolean`
- `status: ViewerStatus` (`"idle" | "loading" | "ready"`)
- `isLoadingMore: boolean`
- `loadNotice: string | null`

**Refs (internal):**
- `loadArchiveRequestIdRef: MutableRefObject<number>`

**Exposed functions:**
```typescript
loadArchivePage(input: LoadArchivePageInput): Promise<void>
// LoadArchivePageInput = { offset, limit, sortField, sortDirection, randomSeed, tagFilter,
//   authorFilter, dateFilterTarget, dateFrom, dateTo, append }

reloadCurrentArchive(limit?: number): Promise<void>
// limit defaults to Math.max(posts.length, DEFAULT_PAGE_SIZE)
// calls loadArchivePage with current sort/filter state — needs sort+filter passed in OR caller rebuilds params
```

**Note on `reloadCurrentArchive`:** Because it needs to know current sort/filter state, it is **not** extracted into `useArchiveLoader`. It remains in `ViewerApp` as a local function that closes over the hook outputs. This is simpler than threading all state back through a callback. `useArchiveLoader` only exposes `loadArchivePage`.

**Returns:**
```typescript
{
  posts, archiveTotalCount, hasMorePosts, status, isLoadingMore, loadNotice,
  loadArchivePage,
  setPosts  // exposed so initializeViewer can set posts: [] on error path
}
```

---

#### `use-sort-filter.ts`
Custom hook. Owns sort state, active filter state, and all handlers that trigger a reload.

**Takes:**
```typescript
{
  loadArchivePage: LoadArchivePageFn   // from useArchiveLoader
}
```

**State:**
- `sortField: PostSortField`
- `sortDirection: SortDirection`
- `randomSeed: number`
- `activeTagFilter: string | null`
- `activeAuthorFilter: string | null`
- `activeDateFilterTarget: DateFilterTarget | null`
- `activeDateFrom: string | null`
- `activeDateTo: string | null`

**Exposed functions/helpers:**
```typescript
getCurrentPostFilterInput(): PostFilterInput
getCurrentDateFilterInput(): { dateFilterTarget, dateFrom, dateTo }
getRandomSeedInput(nextSortField?, seedOverride?): { randomSeed: number | null }

handleSortFieldChange(nextValue: PostSortField): Promise<void>
handleSortDirectionToggle(): Promise<void>
handleReshuffle(): Promise<void>
handleToggleTagFilter(normalizedName: string): Promise<void>
handleToggleAuthorFilter(screenName: string): Promise<void>
handleApplyDateFilter(draftFrom: string, draftTo: string, draftTarget: DateFilterTarget): Promise<void>
handleClearDateFilter(): Promise<void>
handleClearAllFilters(): Promise<void>
handleLoadMore(currentCount: number): Promise<void>

// Setters needed by initializeViewer and handleTagRenamed/handleTagMerged:
setSortField, setSortDirection, setRandomSeed,
setActiveTagFilter, setActiveAuthorFilter,
setActiveDateFilterTarget, setActiveDateFrom, setActiveDateTo
```

**Note on `handleApplyDateFilter`:** Currently it reads draft state internally. Since draft state lives in `useFilterModal`, pass the finalized values as arguments instead of reading draft state from inside the hook. ViewerApp (or useFilterModal's onApply callback) resolves the draft and calls `handleApplyDateFilter(resolvedFrom, resolvedTo, resolvedTarget)`.

---

#### `use-filter-modal.ts`
Custom hook. Owns filter modal open/close state and all draft + search state for the unified filter modal.

**Takes:**
```typescript
{
  availableTags: ArchiveTagSummaryRecord[]
  userSummaries: UserSummary[]
  activeTagFilter: string | null
  activeAuthorFilter: string | null
  activeDateFilterTarget: DateFilterTarget | null
  activeDateFrom: string | null
  activeDateTo: string | null
  language: ArchiveLanguage
  getTagDisplayName: (tag: ArchiveTagRecord) => string
  onApplyDateFilter: (from: string, to: string, target: DateFilterTarget) => Promise<void>
}
```

**State:**
- `isFilterModalOpen: boolean`
- `filterModalActiveTab: FilterModalTab`
- `tagSearchQuery: string`
- `userSearchQuery: string`
- `dateFilterDraftTarget: DateFilterTarget`
- `dateFilterDraftFrom: string`
- `dateFilterDraftTo: string`
- `tagSortOption: TagSortOption`

**Computed (via useMemo + useIncrementalList):**
- `visibleTagOptions`, `displayedTagOptions`, `remainingTagOptionCount`, `hasMoreTagOptions`, `loadMoreTagOptions`
- `visibleUserOptions`, `displayedUserOptions`, `remainingUserOptionCount`, `hasMoreUserOptions`, `loadMoreUserOptions`
- `dateFilterDraftError`

**Returns:** all state + computed + setters + `openFilterModal(tab)` + `closeFilterModal()`

---

#### `use-viewer-preferences.ts`
Custom hook. Owns all persisted viewer settings.

**State:**
- `language: ArchiveLanguage`
- `archiveSettings: ArchiveSettings`
- `viewerTheme: ViewerTheme`
- `fontSize: FontSizeOption`
- `sessionRestoreMode: ViewerSessionRestoreMode`
- `storageEstimate: StorageEstimateState`

**Side effects (internal):**
- `useEffect` for `document.documentElement.setAttribute("data-theme", viewerTheme)`
- `useEffect` for `navigator.storage.estimate()` (triggers on `archiveSummary.mediaBytes + postCount` changes — so it needs those values. Either take them as parameters or ViewerApp calls a returned `refreshStorageEstimate()` function after metadata loads. Simpler: take `{ mediaBytes, postCount }` as a parameter.)

**Takes:**
```typescript
{ archiveMediaBytes: number; archivePostCount: number }
```

**Returns:** all state + `viewerScale: number` + handlers:
```typescript
handleLanguageChange, handleThemeChange, handleFontSizeChange,
handleArchiveSettingsChange, handleSessionRestoreModeChange, handleClearSavedSession
```

---

#### `use-refetch-controls.ts`
Custom hook. Owns refetch status polling and all refetch operation handlers.

**Takes:**
```typescript
{ onRefetchComplete: () => Promise<void>  // called when running→done transition detected }
```

**State:**
- `refetchStatus: RefetchStatusRecord`

**Refs (internal):**
- `previousRefetchStatusRef`

**Side effects (internal):**
- polling `useEffect` with adaptive 1s/5s interval

**Returns:** `refetchStatus` + handlers:
```typescript
handleRefetchPost(xPostId: string): Promise<void>
handleRefetchAllPosts(): Promise<void>
handleRefetchZeroEngagementPosts(): Promise<void>
handleCancelRefetch(): Promise<void>
handleClearRefetchQueue(): Promise<void>
```

---

#### `use-tag-operations.ts`
Custom hook. Owns per-post tag picker state and tag add/remove operations.

**Takes:**
```typescript
{ reloadCurrentArchive: () => Promise<void> }
```

**State:**
- `tagPickerPostId: string | null`
- `tagActionPostId: string | null`

**Side effects (internal):**
- `useEffect` that clears `tagPickerPostId` when the post disappears from the list (takes `posts` as parameter)

**Takes (additional):**
```typescript
{ posts: ArchivePostRecord[] }
```

**Returns:**
```typescript
tagPickerPostId, setTagPickerPostId,
tagActionPostId,
handleAddTagToPost(xPostId: string, displayName: string): Promise<void>
handleRemoveTagFromPost(xPostId: string, normalizedName: string): Promise<void>
```

---

#### `use-viewer-session.ts`
Custom hook. Owns session persistence and scroll/anchor restore.

**Takes:**
```typescript
{
  shouldPersistSessionRef: MutableRefObject<boolean>  // owned by ViewerApp, set true after init
  screen: ViewerScreen
  sessionRestoreMode: ViewerSessionRestoreMode
  sortField: PostSortField
  sortDirection: SortDirection
  activeTagFilter: string | null
  activeAuthorFilter: string | null
  activeDateFilterTarget: DateFilterTarget | null
  activeDateFrom: string | null
  activeDateTo: string | null
  postsLength: number
}
```

**State:**
- `restoreTargetPostId: string | null`

**Refs (internal):**
- `restoreScrollTopRef`

**Side effects (internal):**
- session persist on filter/sort/length change (debounced 250ms)
- scroll listener for position-mode (debounced 300ms)
- scroll restore useEffect (on posts + restoreTargetPostId)

**Returns:**
```typescript
restoreTargetPostId,
persistCurrentViewerSession(overrides?: { anchorPostId?, scrollTop? }): Promise<void>
// used by handleSessionRestoreModeChange in useViewerPreferences
// → useViewerPreferences should accept persistCurrentViewerSession as a parameter
```

**Note:** `shouldPersistSessionRef` stays in `ViewerApp` because it is set to `true` by `initializeViewer` (the startup effect). `useViewerSession` reads it but doesn't own it.

---

#### `post-card.tsx`
Extract the entire `<article>` block (~lines 1611–1851) into a `PostCard` component.

Also move these existing private components/hooks into this file (or a new `media-card.tsx`):
- `QuotedPostCard` (currently line 2179)
- `MediaCard` (currently line 2260)
- `LightboxImage` (currently line 2713)
- `useDeferredVisibility` (currently line 2773)
- `useObjectUrl` (currently line 2804)

**Props for PostCard:**
```typescript
interface PostCardProps {
  post: ArchivePostRecord
  language: ArchiveLanguage
  deletingId: string | null
  tagActionPostId: string | null
  tagPickerPostId: string | null
  refetchCurrentPostId: string | null  // = refetchStatus.currentPostId
  availableTags: ArchiveTagSummaryRecord[]
  getTagDisplayName: (tag: ArchiveTagRecord) => string
  onDelete: (xPostId: string) => void
  onRefetch: (xPostId: string) => void
  onToggleTagFilter: (normalizedName: string) => void
  onOpenMedia: (items: MediaRecord[], currentIndex: number) => void
  onOpenVideo: (media: MediaRecord) => void
  onSetTagPickerPostId: (id: string | null) => void
  onAddTag: (xPostId: string, displayName: string) => Promise<void>
  onRemoveTag: (xPostId: string, normalizedName: string) => Promise<void>
}
```

---

#### `settings-screen.tsx`
Extract the `screen === "settings"` branch (~lines 1879–1980) into a `SettingsScreen` component.

Also move `handleSettingsTabKeyDown` and settings tab state (`settingsTab`, `setSettingsTab`) here.

**Props:**
```typescript
interface SettingsScreenProps {
  language: ArchiveLanguage
  archiveSettings: ArchiveSettings
  viewerTheme: ViewerTheme
  fontSize: FontSizeOption
  sessionRestoreMode: ViewerSessionRestoreMode
  storageEstimate: StorageEstimateState
  archiveSummary: ArchiveSummaryRecord
  refetchStatus: RefetchStatusRecord
  backToArchiveButtonRef: RefObject<HTMLButtonElement>
  onBackToArchive: () => void
  onArchiveSettingsChange: (v: ArchiveSettings) => Promise<void>
  onThemeChange: (v: ViewerTheme) => Promise<void>
  onLanguageChange: (v: ArchiveLanguage) => Promise<void>
  onFontSizeChange: (v: FontSizeOption) => Promise<void>
  onSessionRestoreModeChange: (v: ViewerSessionRestoreMode) => Promise<void>
  onClearSavedSession: () => Promise<void>
  onTagRenamed: (oldName: string, newName: string) => Promise<void>
  onTagMerged: (sourceName: string, targetName: string) => Promise<void>
  onRefetchAll: () => Promise<void>
  onRefetchZeroEngagement: () => Promise<void>
  onRefetchCancel: () => Promise<void>
  onRefetchClear: () => Promise<void>
  onArchiveChanged: () => Promise<void>
}
```

---

#### Image and video lightbox components

Extract `activeMedia !== null && (...)` (lines 2047–2114) and `activeVideo !== null && (...)` (lines 2117–2174) into `ImageLightboxDialog` and `VideoLightboxDialog` components in a new `media-lightbox.tsx` file. The open/close state and the OPFS video loading logic are kept as a `useMediaLightbox` hook (see below or combine into the same file).

**`useMediaLightbox`** (in `media-lightbox.tsx`):

**State:**
- `activeMedia: ActiveMedia | null`
- `activeVideo: ActiveVideo | null`

**Refs (internal):**
- `activeVideoUrlRef`
- `imageLightboxRef`, `imageLightboxCloseButtonRef`
- `videoLightboxRef`, `videoLightboxCloseButtonRef`

**Side effects (internal):**
- video OPFS load useEffect
- video URL revoke-on-close useEffect
- keyboard ArrowLeft/ArrowRight useEffect

**`useDialogA11y` calls** move inside this hook.

**Returns:**
```typescript
{
  activeMedia, setActiveMedia,
  activeVideo, setActiveVideo,
  closeImageLightbox, closeVideoLightbox,
  imageLightboxRef, imageLightboxCloseButtonRef,
  videoLightboxRef, videoLightboxCloseButtonRef
}
```

---

### Pure functions to keep in viewer-app.tsx (unchanged)

None — all pure utility functions (formatCount, createRandomSeed, ArrowLeftIcon, formatPostedAt, formatSavedAt, normalizeTagSearchQuery, normalizeDateInputValue, etc.) move to the file that uses them most. Specifically:
- Date/filter utilities → `use-sort-filter.ts`
- Format functions used only in PostCard → `post-card.tsx`
- Format functions used only in ViewerApp JSX → stay in `viewer-app.tsx`

Alternatively: keep all pure functions in viewer-app.tsx (simpler for the first pass). Codex should use their judgment here.

---

### viewer-app.tsx after decomposition (~600–700 lines)

```typescript
// Imports (~50 lines)
// Type declarations: ViewerStatus, ViewerScreen, DEFAULT_PAGE_SIZE, etc. (~15 lines)
// logger (~1 line)

export function ViewerApp() {
  // Navigation (2 state vars, 2 refs for focus)
  const [screen, setScreen] = useState<ViewerScreen>("archive");
  const settingsButtonRef = useRef<HTMLButtonElement | null>(null);
  const backToArchiveButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousScreenRef = useRef<ViewerScreen>("archive");

  // Archive metadata (3 state vars, 1 function)
  const [availableTags, setAvailableTags] = useState(...)
  const [archiveSummary, setArchiveSummary] = useState(...)
  const [userSummaries, setUserSummaries] = useState(...)
  async function refreshArchiveMetadata() { ... }

  // Hooks
  const archiveLoader = useArchiveLoader();
  const preferences = useViewerPreferences({ archiveMediaBytes: archiveSummary.mediaBytes, archivePostCount: archiveSummary.postCount });
  const sortFilter = useSortFilter({ loadArchivePage: archiveLoader.loadArchivePage });
  const filterModal = useFilterModal({ availableTags, userSummaries, ...sortFilter.activeFilters, language: preferences.language, getTagDisplayName, onApplyDateFilter: sortFilter.handleApplyDateFilter });
  const tagOps = useTagOperations({ reloadCurrentArchive, posts: archiveLoader.posts });
  const refetchControls = useRefetchControls({ onRefetchComplete: refreshArchive });
  const lightbox = useMediaLightbox();
  const shouldPersistSessionRef = useRef(false);
  const session = useViewerSession({ shouldPersistSessionRef, screen, ...preferences.sessionState, ...sortFilter.activeFilters, sortField: sortFilter.sortField, sortDirection: sortFilter.sortDirection, postsLength: archiveLoader.posts.length });

  // Screen navigation effect (focus management)
  // initializeViewer useEffect
  // handleTagRenamed, handleTagMerged (call refreshArchiveMetadata + loadArchivePage)
  // reloadCurrentArchive (local function, closes over sort/filter/posts.length)
  // refreshArchive (= reloadCurrentArchive)
  // isBulkTagModalOpen state + closeBulkTagModal
  // deletingId state + handleDelete

  // filterChips + firstActiveFilterTab derivations

  // JSX:
  //   <StickyToolbar ... />
  //   <section> status/posts.map(<PostCard ... />) + load more button </section>
  //   <SettingsScreen ... />   (conditional on screen === "settings")
  //   <UnifiedFilterModal ... />   (conditional)
  //   <BulkTagModal ... />   (conditional)
  //   <ImageLightboxDialog ... />   (conditional, from lightbox hook)
  //   <VideoLightboxDialog ... />   (conditional, from lightbox hook)
}
```

Estimated line count after this decomposition: **~650 lines**.

---

### `initialLimit` cap (P4-002 fix)

In the `initializeViewer` effect (~line 408):

```typescript
// Before:
initialLimit = Math.max(DEFAULT_PAGE_SIZE, savedSession.loadedCount);

// After:
const MAX_SESSION_RESTORE_LIMIT = 200;
initialLimit = Math.min(Math.max(DEFAULT_PAGE_SIZE, savedSession.loadedCount), MAX_SESSION_RESTORE_LIMIT);
```

`MAX_SESSION_RESTORE_LIMIT = 200` is the proposed cap. 200 posts covers the typical use case of "I had scrolled some distance" while preventing the extreme case of restoring 1,000+ posts. Define this constant alongside `DEFAULT_PAGE_SIZE`.

---

### Sequencing recommendation for Codex

Do these in order. Each step is independently committable and passses typecheck/build:

1. **Cap `initialLimit`** — 2-line change, verify first.
2. **Extract `PostCard`** — moves the largest block of JSX out. No logic changes.
3. **Extract `SettingsScreen`** — straightforward prop threading.
4. **Extract `ImageLightboxDialog` + `VideoLightboxDialog` + `useMediaLightbox`** — self-contained.
5. **Extract `useRefetchControls`** — no external dependencies except runtime client.
6. **Extract `useViewerPreferences`** — no external dependencies except settings storage.
7. **Extract `useTagOperations`** — depends only on `reloadCurrentArchive` callback.
8. **Extract `useArchiveLoader`** — remove state from ViewerApp, verify loadArchivePage signature is stable.
9. **Extract `useSortFilter`** (takes `loadArchivePage` callback) — largest logic extraction.
10. **Extract `useFilterModal`** — mostly state + computed, no side effects beyond useIncrementalList.
11. **Extract `useViewerSession`** — depends on multiple state values from above hooks.

---

## In Scope (updated)

- Implement decomposition as designed above
- All new files under `src/features/viewer/components/`
- Cap `initialLimit` at `MAX_SESSION_RESTORE_LIMIT = 200`
- Follow existing hook patterns (`use-incremental-list.ts`, `use-dialog-a11y.ts`)

## Out Of Scope

- Full virtualization of the post list (separate task if needed)
- Changes to data loading logic or DB queries
- Changes to filter/sort behavior
- Consolidating pure utility functions into a shared utilities file (do whatever is simplest)

## Work Log

- `2026-04-14 Codex`: Added `MAX_SESSION_RESTORE_LIMIT = 200` and capped session restore `initialLimit`; `npm run typecheck` and `npm run build` passed. Viewer decomposition remains in progress; next step is `PostCard` extraction.
- `2026-04-14 Codex`: Extracted `PostCard`, `QuotedPostCard`, and `MediaCard` from `viewer-app.tsx` into `post-card.tsx`; `npm run typecheck` and `npm run build` passed. Viewer decomposition remains in progress; next safe slice is likely `SettingsScreen`.
- `2026-04-14 Codex`: Extracted settings page rendering and settings tab state from `viewer-app.tsx` into `settings-screen.tsx`; `npm run typecheck` and `npm run build` passed. Viewer decomposition remains in progress; next safe slice is likely media lightbox extraction.
- `2026-04-15 Codex`: Extracted media lightbox state, OPFS object URL loading, dialog a11y wiring, keyboard navigation, and dialog rendering from `viewer-app.tsx` into `media-lightbox.tsx`; `npm run typecheck` and `npm run build` passed. Viewer decomposition remains in progress; next safe slice is likely refetch controls or viewer preferences extraction.
- `2026-04-15 Codex`: Committed the cap, `PostCard`, `SettingsScreen`, and media lightbox extraction as `be3716d Decompose viewer app sections`.
- `2026-04-15 Codex`: Extracted refetch status polling and refetch action handlers from `viewer-app.tsx` into `use-refetch-controls.ts`; `npm run typecheck` and `npm run build` passed. Viewer decomposition remains in progress; next safe slice is likely viewer preferences extraction.
- `2026-04-15 Codex`: Extracted viewer preference state, preference persistence handlers, theme side effect, storage estimate state, and preference loading into `use-viewer-preferences.ts`; `npm run typecheck` and `npm run build` passed. Viewer decomposition remains in progress; next safe slice is likely tag operations or archive loader extraction.

## Result

- Partial progress:
  - `initialLimit` session restore is now capped with `MAX_SESSION_RESTORE_LIMIT = 200`.
  - This prevents restoring arbitrarily large loaded counts on viewer open.
  - Post rendering is now extracted to `src/features/viewer/components/post-card.tsx`, including quoted post and media card rendering.
  - Settings page rendering and settings tab state are now extracted to `src/features/viewer/components/settings-screen.tsx`.
  - Media lightbox state, OPFS object URL loading, dialog a11y wiring, keyboard navigation, and rendering are now extracted to `src/features/viewer/components/media-lightbox.tsx`.
  - Refetch status polling and refetch action handlers are now extracted to `src/features/viewer/components/use-refetch-controls.ts`.
  - Viewer preference state, preference persistence handlers, theme side effect, storage estimate state, and preference loading are now extracted to `src/features/viewer/components/use-viewer-preferences.ts`.
  - `viewer-app.tsx` still owns tag operations, archive loading, filtering, and session state; broader decomposition is still active.

## Verification

- `npm run typecheck` passed after `initialLimit` cap.
- `npm run build` passed after `initialLimit` cap.
- `npm run typecheck` passed after `PostCard` extraction.
- `npm run build` passed after `PostCard` extraction.
- `npm run typecheck` passed after `SettingsScreen` extraction.
- `npm run build` passed after `SettingsScreen` extraction.
- `npm run typecheck` passed after media lightbox extraction.
- `npm run build` passed after media lightbox extraction.
- `npm run typecheck` passed after refetch controls extraction.
- `npm run build` passed after refetch controls extraction.
- `npm run typecheck` passed after viewer preferences extraction.
- `npm run build` passed after viewer preferences extraction.

## Completion Checklist
- [x] Claude design review complete (needs_from_claude resolved)
- [x] investigation finished
- [ ] implementation finished
- [x] `npm run typecheck`
- [x] `npm run build`
- [x] task packet `Result` updated
- [x] task packet `Verification` updated
- [x] `ai-handoff/current-task.md` updated
