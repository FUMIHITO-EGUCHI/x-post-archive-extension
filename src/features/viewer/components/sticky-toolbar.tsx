import { formatCount } from "./viewer-formatters";
import { Icon } from "./icons";
import { useEffect, useRef, useState, type RefObject } from "react";
import type { PostSortField, SortDirection } from "../../../types/viewer";
import type { ArchiveLanguage } from "../../settings/archive-language";

export type FilterModalTab = "user" | "tag" | "date";

export type StickyToolbarFilterChip = {
  key: FilterModalTab | "keyword";
  label: string;
  onRemove: () => void;
  excluded?: boolean;
};

export type StickyToolbarProps = {
  language: ArchiveLanguage;
  matchedCount: number;
  totalCount: number;
  isFiltered: boolean;
  settingsButtonRef: RefObject<HTMLButtonElement | null>;
  searchInputRef: RefObject<HTMLInputElement | null>;
  onOpenSettings: () => void;
  onOpenFilter: (tab: FilterModalTab) => void;
  filterChips: StickyToolbarFilterChip[];
  firstActiveFilterTab: FilterModalTab;
  isBulkTagDisabled: boolean;
  isSearchMode: boolean;
  keywordFilter: string | null;
  sortField: PostSortField;
  sortDirection: SortDirection;
  onSortFieldChange: (field: PostSortField) => void;
  onSortDirectionToggle: () => void;
  onReshuffle: () => void;
  onOpenBulkTag: () => void;
  onOpenSearch: () => void;
  onCloseSearch: () => void;
  onKeywordChange: (keyword: string | null) => void;
  onClearAllFilters: () => void;
};

export function StickyToolbar({
  language,
  matchedCount,
  totalCount,
  isFiltered,
  settingsButtonRef,
  searchInputRef,
  onOpenSettings,
  onOpenFilter,
  filterChips,
  firstActiveFilterTab,
  isBulkTagDisabled,
  isSearchMode,
  keywordFilter,
  sortField,
  sortDirection,
  onSortFieldChange,
  onSortDirectionToggle,
  onReshuffle,
  onOpenBulkTag,
  onOpenSearch,
  onCloseSearch,
  onKeywordChange,
  onClearAllFilters
}: StickyToolbarProps) {
  const activeFilterCount = filterChips.length;
  const debounceTimeoutRef = useRef<number | null>(null);
  const [searchValue, setSearchValue] = useState(keywordFilter ?? "");

  useEffect(() => {
    setSearchValue(keywordFilter ?? "");
  }, [keywordFilter]);

  useEffect(() => {
    if (isSearchMode && searchInputRef.current) {
      searchInputRef.current.focus({ preventScroll: true });
    }
  }, [isSearchMode, searchInputRef]);

  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current !== null) {
        window.clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  return (
    <section
      className={`viewer-sticky-toolbar${isSearchMode ? " viewer-sticky-toolbar-search" : ""}`}
      aria-label={language === "ja" ? "アーカイブ操作" : "Archive controls"}
    >
      {isSearchMode && (
        <div className="viewer-search-row">
          <div className="viewer-search-container">
            <button
              className="viewer-icon-button viewer-toolbar-icon-button"
              type="button"
              aria-label={language === "ja" ? "検索を閉じる" : "Close search"}
              title={language === "ja" ? "検索を閉じる" : "Close search"}
              onClick={onCloseSearch}
            >
              <Icon name="Close" />
            </button>
            <input
              ref={searchInputRef}
              className="viewer-search-input"
              type="search"
              value={searchValue}
              placeholder={language === "ja" ? "キーワードで検索..." : "Search by keyword..."}
              onChange={(event) => {
                const nextValue = event.currentTarget.value;
                setSearchValue(nextValue);

                if (debounceTimeoutRef.current !== null) {
                  window.clearTimeout(debounceTimeoutRef.current);
                }

                debounceTimeoutRef.current = window.setTimeout(() => {
                  onKeywordChange(nextValue.trim().length > 0 ? nextValue : null);
                }, 300);
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  onCloseSearch();
                }
              }}
            />
            <button
              className="viewer-secondary-button"
              type="button"
              disabled={searchValue.trim().length === 0 && keywordFilter === null}
              onClick={() => {
                setSearchValue("");

                if (debounceTimeoutRef.current !== null) {
                  window.clearTimeout(debounceTimeoutRef.current);
                  debounceTimeoutRef.current = null;
                }

                onKeywordChange(null);
                searchInputRef.current?.focus({ preventScroll: true });
              }}
            >
              {language === "ja" ? "クリア" : "Clear"}
            </button>
          </div>
        </div>
      )}

      <div className="viewer-toolbar-left">
        {!isSearchMode && (
          <button
            className="viewer-icon-button viewer-toolbar-icon-button"
            type="button"
            aria-label={language === "ja" ? "キーワード検索" : "Keyword search"}
            title={language === "ja" ? "キーワード検索" : "Keyword search"}
            aria-pressed={keywordFilter !== null && keywordFilter.trim().length > 0}
            onClick={onOpenSearch}
          >
            <Icon name="Search" />
          </button>
        )}
        <button
          className={
            activeFilterCount > 0
              ? "viewer-icon-button viewer-toolbar-icon-button viewer-toolbar-icon-button-active viewer-filter-open-button"
              : "viewer-icon-button viewer-toolbar-icon-button viewer-filter-open-button"
          }
          type="button"
          aria-label={language === "ja" ? "絞り込み" : "Filter"}
          title={language === "ja" ? "絞り込み" : "Filter"}
          aria-pressed={activeFilterCount > 0}
          onClick={() => {
            onOpenFilter(firstActiveFilterTab);
          }}
        >
          <Icon name="Filter" />
          {activeFilterCount > 0 && (
            <span className="viewer-filter-open-badge">{activeFilterCount}</span>
          )}
        </button>
        <button
          className="viewer-icon-button viewer-toolbar-icon-button"
          type="button"
          aria-label={language === "ja" ? "絞り込み結果にタグ付け" : "Tag filtered posts"}
          title={language === "ja" ? "絞り込み結果にタグ付け" : "Tag filtered posts"}
          onClick={onOpenBulkTag}
          disabled={isBulkTagDisabled}
        >
          <Icon name="Tag" />
        </button>
      </div>

      {activeFilterCount > 0 && (
        <div
          className="viewer-toolbar-center"
          aria-label={language === "ja" ? "適用中の絞り込み" : "Active filters"}
        >
          <div className="viewer-filter-chip-list">
            {filterChips.map((chip) => {
              const chipName = chip.excluded === true
                ? language === "ja" ? `除外: ${chip.label}` : `Excluded: ${chip.label}`
                : chip.label;

              return (
                <div
                  className={`viewer-filter-chip${chip.excluded ? " viewer-filter-chip-excluded" : ""}`}
                  key={`${chip.key}:${chip.label}`}
                >
                  <button
                    className="viewer-filter-chip-label"
                    type="button"
                    title={chipName}
                    aria-label={chipName}
                    onClick={() => {
                      if (chip.key === "keyword") {
                        onOpenSearch();
                        searchInputRef.current?.focus({ preventScroll: true });
                        return;
                      }
                      onOpenFilter(chip.key);
                    }}
                  >
                    {chip.label}
                  </button>
                  <button
                    className="viewer-filter-chip-clear"
                    type="button"
                    aria-label={language === "ja" ? `${chipName}の絞り込みを解除` : `Remove filter: ${chipName}`}
                    title={language === "ja" ? `${chipName}の絞り込みを解除` : `Remove filter: ${chipName}`}
                    onClick={() => {
                      if (chip.key === "keyword" && debounceTimeoutRef.current !== null) {
                        window.clearTimeout(debounceTimeoutRef.current);
                        debounceTimeoutRef.current = null;
                      }
                      chip.onRemove();
                    }}
                  >
                    <Icon name="Close" />
                  </button>
                </div>
              );
            })}
          </div>
          {activeFilterCount > 1 && (
            <button
              className="viewer-filter-chip-clear-all"
              type="button"
              aria-label={language === "ja" ? "すべての絞り込みを解除" : "Clear all filters"}
              title={language === "ja" ? "すべての絞り込みを解除" : "Clear all filters"}
              onClick={() => {
                if (debounceTimeoutRef.current !== null) {
                  window.clearTimeout(debounceTimeoutRef.current);
                  debounceTimeoutRef.current = null;
                }
                onClearAllFilters();
              }}
            >
              <Icon name="Close" />
            </button>
          )}
        </div>
      )}

      <div className="viewer-toolbar-right">
        <span className="viewer-toolbar-count">
          {isFiltered ? (
            <>
              <strong>{formatCount(matchedCount, language)}</strong> / {formatCount(totalCount, language)}
            </>
          ) : language === "ja" ? (
            `${formatCount(totalCount, language)}件`
          ) : (
            `${formatCount(totalCount, language)} posts`
          )}
        </span>
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
            <option value="posted_at">{language === "ja" ? "投稿日" : "Posted at"}</option>
            <option value="saved_at">{language === "ja" ? "保存日" : "Saved at"}</option>
            <option value="reply_count">{language === "ja" ? "返信数" : "Replies"}</option>
            <option value="repost_count">{language === "ja" ? "リポスト数" : "Reposts"}</option>
            <option value="like_count">{language === "ja" ? "いいね数" : "Likes"}</option>
          </select>
        </label>
        {sortField === "random" ? (
          <button
            className="viewer-secondary-button viewer-toolbar-text-button"
            type="button"
            onClick={onReshuffle}
          >
            {language === "ja" ? "シャッフル" : "Reshuffle"}
          </button>
        ) : (
          <button
            className="viewer-icon-button viewer-toolbar-icon-button viewer-sort-direction-button"
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
            title={
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
            <Icon name={sortDirection === "desc" ? "ArrowDown" : "ArrowUp"} />
          </button>
        )}
        <button
          ref={settingsButtonRef}
          className="viewer-icon-button viewer-toolbar-icon-button viewer-toolbar-settings-button"
          type="button"
          aria-label={language === "ja" ? "設定を開く" : "Open settings"}
          title={language === "ja" ? "設定を開く" : "Open settings"}
          onClick={onOpenSettings}
        >
          <Icon name="Settings" />
        </button>
      </div>
    </section>
  );
}
