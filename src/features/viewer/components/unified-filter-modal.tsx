import { useEffect, useRef, useState } from "react";
import type { ArchiveTagRecord } from "../../../types/archive";
import type {
  ArchiveTagSummaryRecord,
  DateFilterTarget,
  UserSummary
} from "../../../types/viewer";
import type { ArchiveLanguage } from "../../settings/archive-language";
import { useDialogA11y } from "./use-dialog-a11y";
import type { FilterModalTab } from "./sticky-toolbar";

type TagSortOption = "count" | "name";

export type UnifiedFilterModalProps = {
  initialTab: FilterModalTab;
  onClose: () => void;
  language: ArchiveLanguage;
  activeAuthorFilter: string | null;
  selectedAuthorFilter: UserSummary | null;
  userSummaries: UserSummary[];
  displayedUserOptions: UserSummary[];
  hasMoreUserOptions: boolean;
  remainingUserOptionCount: number;
  userSearchQuery: string;
  onUserSearchQueryChange: (value: string) => void;
  onToggleAuthorFilter: (screenName: string) => void;
  onLoadMoreUsers: () => void;
  activeTagFilter: string | null;
  activeExcludeTagFilter: string | null;
  selectedTagFilter: ArchiveTagSummaryRecord | null;
  selectedExcludeTagFilter: ArchiveTagSummaryRecord | null;
  visibleTagOptionCount: number;
  displayedTagOptions: ArchiveTagSummaryRecord[];
  hasMoreTagOptions: boolean;
  remainingTagOptionCount: number;
  tagSearchQuery: string;
  tagSortOption: TagSortOption;
  onTagSearchQueryChange: (value: string) => void;
  onTagSortOptionChange: (value: TagSortOption) => void;
  onToggleTagFilter: (normalizedName: string) => void;
  onToggleExcludeTagFilter: (normalizedName: string) => void;
  onLoadMoreTags: () => void;
  getTagDisplayName: (tag: ArchiveTagRecord) => string;
  activeDateFilterTarget: DateFilterTarget | null;
  activeDateFrom: string | null;
  activeDateTo: string | null;
  hasActiveDateFilter: boolean;
  dateFilterDraftTarget: DateFilterTarget;
  dateFilterDraftFrom: string;
  dateFilterDraftTo: string;
  dateFilterDraftError: string | null;
  onDateFilterDraftTargetChange: (value: DateFilterTarget) => void;
  onDateFilterDraftFromChange: (value: string) => void;
  onDateFilterDraftToChange: (value: string) => void;
  onApplyDateFilter: () => void;
  onClearDateFilter: () => void;
  archiveTotalCount: number;
};

export function UnifiedFilterModal({
  initialTab,
  onClose,
  language,
  activeAuthorFilter,
  selectedAuthorFilter,
  userSummaries,
  displayedUserOptions,
  hasMoreUserOptions,
  remainingUserOptionCount,
  userSearchQuery,
  onUserSearchQueryChange,
  onToggleAuthorFilter,
  onLoadMoreUsers,
  activeTagFilter,
  activeExcludeTagFilter,
  selectedTagFilter,
  selectedExcludeTagFilter,
  visibleTagOptionCount,
  displayedTagOptions,
  hasMoreTagOptions,
  remainingTagOptionCount,
  tagSearchQuery,
  tagSortOption,
  onTagSearchQueryChange,
  onTagSortOptionChange,
  onToggleTagFilter,
  onToggleExcludeTagFilter,
  onLoadMoreTags,
  getTagDisplayName,
  activeDateFilterTarget,
  activeDateFrom,
  activeDateTo,
  hasActiveDateFilter,
  dateFilterDraftTarget,
  dateFilterDraftFrom,
  dateFilterDraftTo,
  dateFilterDraftError,
  onDateFilterDraftTargetChange,
  onDateFilterDraftFromChange,
  onDateFilterDraftToChange,
  onApplyDateFilter,
  onClearDateFilter,
  archiveTotalCount
}: UnifiedFilterModalProps) {
  const [activeTab, setActiveTab] = useState<FilterModalTab>(initialTab);
  const dialogRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const dialogTitleId = "viewer-unified-filter-title";
  const activeTabPanelId = getTabPanelId(activeTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useDialogA11y({
    isOpen: true,
    containerRef: dialogRef,
    initialFocusRef: closeButtonRef,
    onClose
  });

  const tabOptions = [
    {
      tab: "user" as const,
      label: language === "ja" ? "ユーザー" : "User",
      isActive: activeAuthorFilter !== null
    },
    {
      tab: "tag" as const,
      label: language === "ja" ? "タグ" : "Tag",
      isActive: activeTagFilter !== null || activeExcludeTagFilter !== null
    },
    {
      tab: "date" as const,
      label: language === "ja" ? "日付" : "Date",
      isActive: hasActiveDateFilter
    }
  ];

  return (
    <div
      className="viewer-modal-backdrop"
      role="presentation"
      onClick={() => {
        onClose();
      }}
    >
      <section
        ref={dialogRef}
        className="viewer-modal viewer-unified-filter-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={dialogTitleId}
        tabIndex={-1}
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <div className="viewer-filter-modal-header">
          <div className="viewer-modal-copy">
            <h2 id={dialogTitleId}>{language === "ja" ? "絞り込み" : "Filters"}</h2>
            <p>
              {language === "ja"
                ? "ユーザー、タグ、日付で保存済み投稿を絞り込みます。"
                : "Filter saved posts by user, tag, or date."}
            </p>
          </div>
          <button
            ref={closeButtonRef}
            className="viewer-filter-modal-close"
            type="button"
            aria-label={language === "ja" ? "絞り込みを閉じる" : "Close filters"}
            onClick={() => {
              onClose();
            }}
          >
            ×
          </button>
        </div>

        <div className="viewer-filter-modal-tabs" role="tablist" aria-label={language === "ja" ? "絞り込み種別" : "Filter type"}>
          {tabOptions.map((option) => (
            <button
              id={getTabButtonId(option.tab)}
              className={
                option.tab === activeTab
                  ? "viewer-filter-tab-button viewer-filter-tab-button-active"
                  : "viewer-filter-tab-button"
              }
              type="button"
              role="tab"
              aria-selected={option.tab === activeTab}
              aria-controls={getTabPanelId(option.tab)}
              key={option.tab}
              onClick={() => {
                setActiveTab(option.tab);
              }}
            >
              <span>{option.label}</span>
              {option.isActive && <span className="viewer-filter-tab-badge">1</span>}
            </button>
          ))}
        </div>

        <div
          id={activeTabPanelId}
          className="viewer-filter-tab-panel"
          role="tabpanel"
          aria-labelledby={getTabButtonId(activeTab)}
        >
          {activeTab === "user" && (
            <UserFilterPanel
              activeAuthorFilter={activeAuthorFilter}
              archiveTotalCount={archiveTotalCount}
              displayedUserOptions={displayedUserOptions}
              hasMoreUserOptions={hasMoreUserOptions}
              language={language}
              onLoadMoreUsers={onLoadMoreUsers}
              onToggleAuthorFilter={onToggleAuthorFilter}
              onUserSearchQueryChange={onUserSearchQueryChange}
              remainingUserOptionCount={remainingUserOptionCount}
              selectedAuthorFilter={selectedAuthorFilter}
              userSearchQuery={userSearchQuery}
              userSummaries={userSummaries}
            />
          )}

          {activeTab === "tag" && (
            <TagFilterPanel
              activeTagFilter={activeTagFilter}
              activeExcludeTagFilter={activeExcludeTagFilter}
              displayedTagOptions={displayedTagOptions}
              getTagDisplayName={getTagDisplayName}
              hasMoreTagOptions={hasMoreTagOptions}
              language={language}
              onLoadMoreTags={onLoadMoreTags}
              onTagSearchQueryChange={onTagSearchQueryChange}
              onTagSortOptionChange={onTagSortOptionChange}
              onToggleExcludeTagFilter={onToggleExcludeTagFilter}
              onToggleTagFilter={onToggleTagFilter}
              remainingTagOptionCount={remainingTagOptionCount}
              selectedTagFilter={selectedTagFilter}
              selectedExcludeTagFilter={selectedExcludeTagFilter}
              tagSearchQuery={tagSearchQuery}
              tagSortOption={tagSortOption}
              visibleTagOptionCount={visibleTagOptionCount}
            />
          )}

          {activeTab === "date" && (
            <DateFilterPanel
              activeDateFilterTarget={activeDateFilterTarget}
              activeDateFrom={activeDateFrom}
              activeDateTo={activeDateTo}
              archiveTotalCount={archiveTotalCount}
              dateFilterDraftError={dateFilterDraftError}
              dateFilterDraftFrom={dateFilterDraftFrom}
              dateFilterDraftTarget={dateFilterDraftTarget}
              dateFilterDraftTo={dateFilterDraftTo}
              hasActiveDateFilter={hasActiveDateFilter}
              language={language}
              onApplyDateFilter={onApplyDateFilter}
              onClearDateFilter={onClearDateFilter}
              onDateFilterDraftFromChange={onDateFilterDraftFromChange}
              onDateFilterDraftTargetChange={onDateFilterDraftTargetChange}
              onDateFilterDraftToChange={onDateFilterDraftToChange}
            />
          )}
        </div>
      </section>
    </div>
  );
}

function UserFilterPanel({
  activeAuthorFilter,
  archiveTotalCount,
  displayedUserOptions,
  hasMoreUserOptions,
  language,
  onLoadMoreUsers,
  onToggleAuthorFilter,
  onUserSearchQueryChange,
  remainingUserOptionCount,
  selectedAuthorFilter,
  userSearchQuery,
  userSummaries
}: {
  activeAuthorFilter: string | null;
  archiveTotalCount: number;
  displayedUserOptions: UserSummary[];
  hasMoreUserOptions: boolean;
  language: ArchiveLanguage;
  onLoadMoreUsers: () => void;
  onToggleAuthorFilter: (screenName: string) => void;
  onUserSearchQueryChange: (value: string) => void;
  remainingUserOptionCount: number;
  selectedAuthorFilter: UserSummary | null;
  userSearchQuery: string;
  userSummaries: UserSummary[];
}) {
  const optionList = useInfiniteOptionList({
    hasMore: hasMoreUserOptions,
    itemCount: displayedUserOptions.length,
    onLoadMore: onLoadMoreUsers
  });

  return (
    <>
      <div className="viewer-user-modal-controls">
        <label className="viewer-sort-label">
          <span>{language === "ja" ? "検索" : "Search"}</span>
          <input
            className="tag-input"
            type="search"
            value={userSearchQuery}
            aria-label={language === "ja" ? "ユーザーを検索" : "Search users"}
            placeholder={language === "ja" ? "ユーザーを検索" : "Search users"}
            onChange={(event) => {
              onUserSearchQueryChange(event.currentTarget.value);
            }}
          />
        </label>
      </div>

      {activeAuthorFilter !== null && (
        <div className="viewer-tag-modal-summary">
          <span>
            {language === "ja" ? "適用中" : "Active"}:{" "}
            {formatAuthorFilterLabel(
              selectedAuthorFilter,
              activeAuthorFilter,
              archiveTotalCount,
              language
            )}
          </span>
          <button
            className="viewer-tag-filter-clear"
            type="button"
            onClick={() => {
              onToggleAuthorFilter(activeAuthorFilter);
            }}
          >
            {language === "ja" ? "解除" : "Clear"}
          </button>
        </div>
      )}

      {userSummaries.length === 0 || displayedUserOptions.length === 0 ? (
        <p className="viewer-message">
          {language === "ja"
            ? "現在の検索条件に一致するユーザーはありません。"
            : "No users match the current search."}
        </p>
      ) : (
        <>
          <div ref={optionList.containerRef} className="viewer-tag-option-list">
            {displayedUserOptions.map((user) => (
              <button
                key={user.screen_name}
                className={
                  user.screen_name === activeAuthorFilter
                    ? "viewer-tag-option viewer-tag-option-active"
                    : "viewer-tag-option"
                }
                type="button"
                onClick={() => {
                  onToggleAuthorFilter(user.screen_name);
                }}
              >
                <strong>{formatUserSummaryLabel(user)}</strong>
                <span>
                  {formatCount(user.post_count, language)} {language === "ja" ? "件" : "posts"}
                </span>
              </button>
            ))}
            {hasMoreUserOptions && (
              <div
                ref={optionList.sentinelRef}
                className="viewer-option-list-sentinel"
                aria-hidden="true"
              />
            )}
          </div>
          {false && hasMoreUserOptions && (
            <div className="viewer-incremental-list-footer">
              <p className="viewer-incremental-list-meta">
                {language === "ja"
                  ? `残り ${formatCount(remainingUserOptionCount, language)} 人のユーザーがいます。`
                  : `${formatCount(remainingUserOptionCount, language)} more users available.`}
              </p>
              <button className="viewer-secondary-button" type="button" onClick={onLoadMoreUsers}>
                {language === "ja" ? "さらに表示" : "Load more"}
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}

function TagFilterPanel({
  activeTagFilter,
  activeExcludeTagFilter,
  displayedTagOptions,
  getTagDisplayName,
  hasMoreTagOptions,
  language,
  onLoadMoreTags,
  onTagSearchQueryChange,
  onTagSortOptionChange,
  onToggleExcludeTagFilter,
  onToggleTagFilter,
  remainingTagOptionCount,
  selectedTagFilter,
  selectedExcludeTagFilter,
  tagSearchQuery,
  tagSortOption,
  visibleTagOptionCount
}: {
  activeTagFilter: string | null;
  activeExcludeTagFilter: string | null;
  displayedTagOptions: ArchiveTagSummaryRecord[];
  getTagDisplayName: (tag: ArchiveTagRecord) => string;
  hasMoreTagOptions: boolean;
  language: ArchiveLanguage;
  onLoadMoreTags: () => void;
  onTagSearchQueryChange: (value: string) => void;
  onTagSortOptionChange: (value: TagSortOption) => void;
  onToggleExcludeTagFilter: (normalizedName: string) => void;
  onToggleTagFilter: (normalizedName: string) => void;
  remainingTagOptionCount: number;
  selectedTagFilter: ArchiveTagSummaryRecord | null;
  selectedExcludeTagFilter: ArchiveTagSummaryRecord | null;
  tagSearchQuery: string;
  tagSortOption: TagSortOption;
  visibleTagOptionCount: number;
}) {
  const optionList = useInfiniteOptionList({
    hasMore: hasMoreTagOptions,
    itemCount: displayedTagOptions.length,
    onLoadMore: onLoadMoreTags
  });

  return (
    <>
      <div className="viewer-tag-modal-controls">
        <label className="viewer-sort-label">
          <span>{language === "ja" ? "検索" : "Search"}</span>
          <input
            className="tag-input"
            type="search"
            value={tagSearchQuery}
            aria-label={language === "ja" ? "タグを検索" : "Search tags"}
            placeholder={language === "ja" ? "タグを検索" : "Search tags"}
            onChange={(event) => {
              onTagSearchQueryChange(event.currentTarget.value);
            }}
          />
        </label>
        <label className="viewer-sort-label">
          <span>{language === "ja" ? "並び順" : "Order"}</span>
          <select
            className="viewer-sort-select"
            value={tagSortOption}
            onChange={(event) => {
              onTagSortOptionChange(event.currentTarget.value as TagSortOption);
            }}
          >
            <option value="count">{language === "ja" ? "使用数順" : "Most used"}</option>
            <option value="name">{language === "ja" ? "名前順" : "A to Z"}</option>
          </select>
        </label>
      </div>

      {selectedTagFilter !== null && (
        <div className="viewer-tag-modal-summary">
          <span>
            {language === "ja" ? "適用中" : "Active"}:{" "}
            {formatTagFilterLabel(
              getTagDisplayName(selectedTagFilter.tag),
              selectedTagFilter.postCount,
              language
            )}
          </span>
          <button
            className="viewer-tag-filter-clear"
            type="button"
            onClick={() => {
              onToggleTagFilter(selectedTagFilter.tag.normalized_name);
            }}
          >
            {language === "ja" ? "解除" : "Clear"}
          </button>
        </div>
      )}

      {selectedExcludeTagFilter !== null && (
        <div className="viewer-tag-modal-summary">
          <span>
            {language === "ja" ? "\u9664\u5916\u4e2d" : "Excluded"}: {" "}
            {formatTagFilterLabel(
              getTagDisplayName(selectedExcludeTagFilter.tag),
              selectedExcludeTagFilter.postCount,
              language
            )}
          </span>
          <button
            className="viewer-tag-filter-clear"
            type="button"
            onClick={() => {
              onToggleExcludeTagFilter(selectedExcludeTagFilter.tag.normalized_name);
            }}
          >
            {language === "ja" ? "\u89e3\u9664" : "Clear"}
          </button>
        </div>
      )}

      {visibleTagOptionCount === 0 ? (
        <p className="viewer-message">
          {language === "ja"
            ? "現在の検索条件に一致するタグはありません。"
            : "No tags match the current search."}
        </p>
      ) : (
        <>
          <div ref={optionList.containerRef} className="viewer-tag-option-list">
            {displayedTagOptions.map(({ tag, postCount }) => {
              const isIncluded = tag.normalized_name === activeTagFilter;
              const isExcluded = tag.normalized_name === activeExcludeTagFilter;

              return (
                <div key={tag.tag_id} className="viewer-tag-option-row">
                  <span className="viewer-tag-option-label">
                    <strong>{getTagDisplayName(tag)}</strong>
                    <span>
                      {formatCount(postCount, language)} {language === "ja" ? "\u4ef6" : "posts"}
                    </span>
                  </span>
                  <button
                    className={
                      isIncluded
                        ? "viewer-tag-option-btn viewer-tag-option-btn-active"
                        : "viewer-tag-option-btn"
                    }
                    type="button"
                    aria-pressed={isIncluded}
                    onClick={() => {
                      onToggleTagFilter(tag.normalized_name);
                    }}
                  >
                    {language === "ja" ? "\u7d5e\u308a\u8fbc\u3080" : "Include"}
                  </button>
                  <button
                    className={
                      isExcluded
                        ? "viewer-tag-option-btn viewer-tag-option-btn-exclude viewer-tag-option-btn-active"
                        : "viewer-tag-option-btn viewer-tag-option-btn-exclude"
                    }
                    type="button"
                    aria-pressed={isExcluded}
                    onClick={() => {
                      onToggleExcludeTagFilter(tag.normalized_name);
                    }}
                  >
                    {language === "ja" ? "\u9664\u5916" : "Exclude"}
                  </button>
                </div>
              );
            })}
            {hasMoreTagOptions && (
              <div
                ref={optionList.sentinelRef}
                className="viewer-option-list-sentinel"
                aria-hidden="true"
              />
            )}
          </div>
          {false && hasMoreTagOptions && (
            <div className="viewer-incremental-list-footer">
              <p className="viewer-incremental-list-meta">
                {language === "ja"
                  ? `残り ${formatCount(remainingTagOptionCount, language)} 件のタグがあります。`
                  : `${formatCount(remainingTagOptionCount, language)} more tags available.`}
              </p>
              <button className="viewer-secondary-button" type="button" onClick={onLoadMoreTags}>
                {language === "ja" ? "さらに表示" : "Load more"}
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}

function useInfiniteOptionList({
  hasMore,
  itemCount,
  onLoadMore
}: {
  hasMore: boolean;
  itemCount: number;
  onLoadMore: () => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const onLoadMoreRef = useRef(onLoadMore);
  const loadRequestedRef = useRef(false);

  useEffect(() => {
    onLoadMoreRef.current = onLoadMore;
  }, [onLoadMore]);

  useEffect(() => {
    loadRequestedRef.current = false;
  }, [itemCount]);

  useEffect(() => {
    if (!hasMore) {
      return;
    }

    const container = containerRef.current;
    const sentinel = sentinelRef.current;
    if (container === null || sentinel === null) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (loadRequestedRef.current || entries.every((entry) => !entry.isIntersecting)) {
          return;
        }

        loadRequestedRef.current = true;
        onLoadMoreRef.current();
      },
      {
        root: container,
        rootMargin: "120px 0px"
      }
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [hasMore, itemCount]);

  return {
    containerRef,
    sentinelRef
  };
}

function DateFilterPanel({
  activeDateFilterTarget,
  activeDateFrom,
  activeDateTo,
  archiveTotalCount,
  dateFilterDraftError,
  dateFilterDraftFrom,
  dateFilterDraftTarget,
  dateFilterDraftTo,
  hasActiveDateFilter,
  language,
  onApplyDateFilter,
  onClearDateFilter,
  onDateFilterDraftFromChange,
  onDateFilterDraftTargetChange,
  onDateFilterDraftToChange
}: {
  activeDateFilterTarget: DateFilterTarget | null;
  activeDateFrom: string | null;
  activeDateTo: string | null;
  archiveTotalCount: number;
  dateFilterDraftError: string | null;
  dateFilterDraftFrom: string;
  dateFilterDraftTarget: DateFilterTarget;
  dateFilterDraftTo: string;
  hasActiveDateFilter: boolean;
  language: ArchiveLanguage;
  onApplyDateFilter: () => void;
  onClearDateFilter: () => void;
  onDateFilterDraftFromChange: (value: string) => void;
  onDateFilterDraftTargetChange: (value: DateFilterTarget) => void;
  onDateFilterDraftToChange: (value: string) => void;
}) {
  return (
    <>
      <div className="viewer-date-modal-controls">
        <label className="viewer-sort-label">
          <span>{language === "ja" ? "対象" : "Target"}</span>
          <select
            className="viewer-sort-select"
            value={dateFilterDraftTarget}
            onChange={(event) => {
              onDateFilterDraftTargetChange(event.currentTarget.value as DateFilterTarget);
            }}
          >
            <option value="saved_at">{language === "ja" ? "保存日時" : "Saved at"}</option>
            <option value="posted_at">{language === "ja" ? "投稿日時" : "Posted at"}</option>
          </select>
        </label>
        <label className="viewer-sort-label">
          <span>{language === "ja" ? "開始日" : "Start date"}</span>
          <input
            className="tag-input"
            type="date"
            value={dateFilterDraftFrom}
            onChange={(event) => {
              onDateFilterDraftFromChange(event.currentTarget.value);
            }}
          />
        </label>
        <label className="viewer-sort-label">
          <span>{language === "ja" ? "終了日" : "End date"}</span>
          <input
            className="tag-input"
            type="date"
            value={dateFilterDraftTo}
            onChange={(event) => {
              onDateFilterDraftToChange(event.currentTarget.value);
            }}
          />
        </label>
      </div>

      {hasActiveDateFilter && (
        <div className="viewer-tag-modal-summary">
          <span>
            {language === "ja" ? "適用中" : "Active"}:{" "}
            {formatActiveDateFilterLabel(
              activeDateFilterTarget ?? "saved_at",
              activeDateFrom,
              activeDateTo,
              archiveTotalCount,
              language
            )}
          </span>
          <button className="viewer-tag-filter-clear" type="button" onClick={onClearDateFilter}>
            {language === "ja" ? "解除" : "Clear"}
          </button>
        </div>
      )}

      {dateFilterDraftError !== null && (
        <p className="viewer-modal-inline-error">{dateFilterDraftError}</p>
      )}

      <div className="viewer-modal-actions">
        <button className="viewer-secondary-button" type="button" onClick={onClearDateFilter}>
          {language === "ja" ? "クリア" : "Clear"}
        </button>
        <button
          className="viewer-action-button"
          type="button"
          onClick={onApplyDateFilter}
          disabled={dateFilterDraftError !== null}
        >
          {language === "ja" ? "適用" : "Apply"}
        </button>
      </div>
    </>
  );
}

function formatCount(value: number, language: ArchiveLanguage = "en"): string {
  return new Intl.NumberFormat(language === "ja" ? "ja-JP" : "en-US").format(value);
}

function formatTagFilterLabel(
  tagName: string,
  postCount: number,
  language: ArchiveLanguage
): string {
  return language === "ja"
    ? `${tagName} (${formatCount(postCount, language)}件)`
    : `${tagName} (${formatCount(postCount, language)})`;
}

function formatUserSummaryLabel(user: UserSummary): string {
  return `${user.display_name} (@${user.screen_name})`;
}

function formatAuthorFilterLabel(
  selectedAuthorFilter: UserSummary | null,
  activeAuthorFilter: string,
  postCount: number,
  language: ArchiveLanguage
): string {
  const authorLabel =
    selectedAuthorFilter === null
      ? `@${activeAuthorFilter}`
      : formatUserSummaryLabel(selectedAuthorFilter);

  return language === "ja"
    ? `${authorLabel} (${formatCount(postCount, language)}件)`
    : `${authorLabel} (${formatCount(postCount, language)})`;
}

function formatDateFilterTargetLabel(
  dateFilterTarget: DateFilterTarget,
  language: ArchiveLanguage
): string {
  if (dateFilterTarget === "posted_at") {
    return language === "ja" ? "投稿日時" : "Posted at";
  }

  return language === "ja" ? "保存日時" : "Saved at";
}

function formatDateInputLabel(value: string, language: ArchiveLanguage): string {
  const date = parseLocalDateInput(value);

  if (date === null) {
    return value;
  }

  return new Intl.DateTimeFormat(language === "ja" ? "ja-JP" : "en-US", {
    dateStyle: "medium"
  }).format(date);
}

function formatDateFilterConditionLabel(
  dateFilterTarget: DateFilterTarget,
  dateFrom: string | null,
  dateTo: string | null,
  language: ArchiveLanguage
): string {
  const targetLabel = formatDateFilterTargetLabel(dateFilterTarget, language);
  const fromLabel = dateFrom === null ? null : formatDateInputLabel(dateFrom, language);
  const toLabel = dateTo === null ? null : formatDateInputLabel(dateTo, language);

  if (fromLabel !== null && toLabel !== null) {
    return language === "ja"
      ? `${targetLabel}: ${fromLabel} - ${toLabel}`
      : `${targetLabel}: ${fromLabel} to ${toLabel}`;
  }

  if (fromLabel !== null) {
    return language === "ja"
      ? `${targetLabel}: ${fromLabel} 以降`
      : `${targetLabel}: from ${fromLabel}`;
  }

  if (toLabel !== null) {
    return language === "ja"
      ? `${targetLabel}: ${toLabel} 以前`
      : `${targetLabel}: until ${toLabel}`;
  }

  return targetLabel;
}

function formatActiveDateFilterLabel(
  dateFilterTarget: DateFilterTarget,
  dateFrom: string | null,
  dateTo: string | null,
  totalCount: number,
  language: ArchiveLanguage
): string {
  const dateConditionLabel = formatDateFilterConditionLabel(
    dateFilterTarget,
    dateFrom,
    dateTo,
    language
  );

  return language === "ja"
    ? `${dateConditionLabel} (${formatCount(totalCount, language)}件)`
    : `${dateConditionLabel} (${formatCount(totalCount, language)})`;
}

function normalizeDateInputValue(value: string): string | null {
  const trimmedValue = value.trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmedValue)) {
    return null;
  }

  return trimmedValue;
}

function parseLocalDateInput(value: string): Date | null {
  const normalizedValue = normalizeDateInputValue(value);

  if (normalizedValue === null) {
    return null;
  }

  const [yearText, monthText, dayText] = normalizedValue.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }

  const date = new Date(year, month - 1, day, 0, 0, 0, 0);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function getTabButtonId(tab: FilterModalTab): string {
  return `viewer-filter-tab-${tab}`;
}

function getTabPanelId(tab: FilterModalTab): string {
  return `viewer-filter-panel-${tab}`;
}
