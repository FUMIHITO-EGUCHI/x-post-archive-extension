import type { RefObject } from "react";
import type { PostSortField, SortDirection } from "../../../types/viewer";
import type { ArchiveLanguage } from "../../settings/archive-language";

export type FilterModalTab = "user" | "tag" | "date";

export type StickyToolbarFilterChip = {
  key: FilterModalTab;
};

export type StickyToolbarProps = {
  language: ArchiveLanguage;
  countLabel: string;
  settingsButtonRef: RefObject<HTMLButtonElement | null>;
  onOpenSettings: () => void;
  onOpenFilter: (tab: FilterModalTab) => void;
  filterChips: StickyToolbarFilterChip[];
  firstActiveFilterTab: FilterModalTab;
  isBulkTagDisabled: boolean;
  sortField: PostSortField;
  sortDirection: SortDirection;
  onSortFieldChange: (field: PostSortField) => void;
  onSortDirectionToggle: () => void;
  onReshuffle: () => void;
  onOpenBulkTag: () => void;
  onClearAllFilters: () => void;
};

export function StickyToolbar({
  language,
  countLabel,
  settingsButtonRef,
  onOpenSettings,
  onOpenFilter,
  filterChips,
  firstActiveFilterTab,
  isBulkTagDisabled,
  sortField,
  sortDirection,
  onSortFieldChange,
  onSortDirectionToggle,
  onReshuffle,
  onOpenBulkTag,
  onClearAllFilters
}: StickyToolbarProps) {
  const activeFilterCount = filterChips.length;

  return (
    <section className="viewer-sticky-toolbar" aria-label={language === "ja" ? "一覧操作" : "Archive controls"}>
      <div className="viewer-toolbar-left">
        <button
          className={
            activeFilterCount > 0
              ? "viewer-secondary-button viewer-secondary-button-active viewer-filter-open-button"
              : "viewer-secondary-button viewer-filter-open-button"
          }
          type="button"
          aria-pressed={activeFilterCount > 0}
          onClick={() => {
            onOpenFilter(firstActiveFilterTab);
          }}
        >
          <span>{language === "ja" ? "絞り込み" : "Filter"}</span>
          {activeFilterCount > 0 && (
            <span className="viewer-filter-open-badge">{activeFilterCount}</span>
          )}
        </button>
        <button
          className="viewer-secondary-button"
          type="button"
          onClick={onOpenBulkTag}
          disabled={isBulkTagDisabled}
        >
          {language === "ja" ? "一括タグ付け" : "Bulk tag"}
        </button>
      </div>

      <div className="viewer-toolbar-center" aria-label={language === "ja" ? "適用中の絞り込み" : "Active filters"}>
        {activeFilterCount === 0 ? (
          <span className="viewer-toolbar-empty">
            {language === "ja" ? "絞り込みなし" : "No filters"}
          </span>
        ) : (
          <span
            className="viewer-filter-chip-collapsed"
            aria-label={language === "ja" ? "適用中の絞り込み" : "Active filters"}
          >
            <button
              className="viewer-filter-chip-overflow viewer-filter-chip-overflow-inner"
              type="button"
              onClick={() => {
                onOpenFilter(firstActiveFilterTab);
              }}
            >
              {language === "ja"
                ? `+${activeFilterCount} 件の絞り込み中`
                : `+${activeFilterCount} active filters`}
            </button>
            <button
              className="viewer-filter-chip-clear-all"
              type="button"
              aria-label={language === "ja" ? "すべての絞り込みを解除" : "Clear all filters"}
              onClick={onClearAllFilters}
            >
              ×
            </button>
          </span>
        )}
      </div>

      <div className="viewer-toolbar-right">
        <span className="viewer-toolbar-count">{countLabel}</span>
        <label className="viewer-sort-label viewer-sort-label-inline">
          <span className="viewer-visually-hidden">
            {language === "ja" ? "並び順" : "Sort"}
          </span>
          <select
            className="viewer-sort-select"
            value={sortField}
            onChange={(event) => {
              onSortFieldChange(event.currentTarget.value as PostSortField);
            }}
          >
            <option value="random">{language === "ja" ? "ランダム" : "Random"}</option>
            <option value="posted_at">{language === "ja" ? "投稿日時" : "Posted at"}</option>
            <option value="saved_at">{language === "ja" ? "保存日時" : "Saved at"}</option>
            <option value="reply_count">{language === "ja" ? "返信数" : "Replies"}</option>
            <option value="repost_count">{language === "ja" ? "リポスト数" : "Reposts"}</option>
            <option value="like_count">{language === "ja" ? "いいね数" : "Likes"}</option>
          </select>
        </label>
        {sortField === "random" ? (
          <button className="viewer-secondary-button" type="button" onClick={onReshuffle}>
            {language === "ja" ? "再シャッフル" : "Reshuffle"}
          </button>
        ) : (
          <button
            className="viewer-sort-direction-button"
            type="button"
            aria-label={
              sortDirection === "desc"
                ? language === "ja"
                  ? "降順で並び替え中。昇順へ切り替える"
                  : "Sorting descending. Switch to ascending"
                : language === "ja"
                  ? "昇順で並び替え中。降順へ切り替える"
                  : "Sorting ascending. Switch to descending"
            }
            onClick={onSortDirectionToggle}
          >
            {sortDirection === "desc"
              ? language === "ja"
                ? "降順"
                : "Desc"
              : language === "ja"
                ? "昇順"
                : "Asc"}
          </button>
        )}
        <button
          ref={settingsButtonRef}
          className="viewer-icon-button viewer-toolbar-settings-button"
          type="button"
          aria-label={language === "ja" ? "設定を開く" : "Open settings"}
          onClick={onOpenSettings}
        >
          <GearIcon />
        </button>
      </div>
    </section>
  );
}

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M19.14 12.94a7.43 7.43 0 0 0 .05-.94 7.43 7.43 0 0 0-.05-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.15 7.15 0 0 0-1.63-.94L14.4 2.8a.49.49 0 0 0-.49-.4h-3.84a.49.49 0 0 0-.49.4L9.2 5.32c-.58.22-1.13.53-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.66 8.84a.5.5 0 0 0 .12.64l2.03 1.58a7.43 7.43 0 0 0-.05.94 7.43 7.43 0 0 0 .05.94l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32c.13.22.39.31.6.22l2.39-.96c.5.41 1.05.72 1.63.94l.38 2.52c.05.24.25.4.49.4h3.84c.24 0 .44-.16.49-.4l.38-2.52c.58-.22 1.13-.53 1.63-.94l2.39.96c.22.09.47 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z"
        fill="currentColor"
      />
    </svg>
  );
}
