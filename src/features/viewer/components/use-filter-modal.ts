import { useMemo, useState } from "react";
import type { ArchiveTagRecord } from "../../../types/archive";
import type {
  ArchiveTagSummaryRecord,
  DateFilterTarget,
  UserSummary
} from "../../../types/viewer";
import type { ArchiveLanguage } from "../../settings/archive-language";
import type { FilterModalTab } from "./sticky-toolbar";
import { useIncrementalList } from "./use-incremental-list";
import { DEFAULT_DATE_FILTER_TARGET } from "./use-sort-filter";

export type TagSortOption = "count" | "name";

const FILTER_MODAL_LIST_SIZE = 40;

export function useFilterModal({
  activeAuthorFilter,
  activeDateFilterTarget,
  activeDateFrom,
  activeDateTo,
  activeTagFilter,
  availableTags,
  getTagDisplayName,
  language,
  userSummaries
}: {
  activeAuthorFilter: string | null;
  activeDateFilterTarget: DateFilterTarget | null;
  activeDateFrom: string | null;
  activeDateTo: string | null;
  activeTagFilter: string | null;
  availableTags: ArchiveTagSummaryRecord[];
  getTagDisplayName: (tag: ArchiveTagRecord) => string;
  language: ArchiveLanguage;
  userSummaries: UserSummary[];
}) {
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [filterModalActiveTab, setFilterModalActiveTab] = useState<FilterModalTab>("user");
  const [tagSearchQuery, setTagSearchQuery] = useState("");
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [dateFilterDraftTarget, setDateFilterDraftTarget] =
    useState<DateFilterTarget>(DEFAULT_DATE_FILTER_TARGET);
  const [dateFilterDraftFrom, setDateFilterDraftFrom] = useState("");
  const [dateFilterDraftTo, setDateFilterDraftTo] = useState("");
  const [tagSortOption, setTagSortOption] = useState<TagSortOption>("count");

  const dateFilterDraftError = getDateFilterDraftError(
    dateFilterDraftFrom,
    dateFilterDraftTo,
    language
  );

  function openFilterModal(tab: FilterModalTab) {
    setDateFilterDraftTarget(activeDateFilterTarget ?? DEFAULT_DATE_FILTER_TARGET);
    setDateFilterDraftFrom(activeDateFrom ?? "");
    setDateFilterDraftTo(activeDateTo ?? "");

    setFilterModalActiveTab(tab);
    setIsFilterModalOpen(true);
  }

  function closeFilterModal() {
    setIsFilterModalOpen(false);
  }

  function resetDateFilterDraft() {
    setDateFilterDraftTarget(DEFAULT_DATE_FILTER_TARGET);
    setDateFilterDraftFrom("");
    setDateFilterDraftTo("");
  }

  const visibleTagOptions = useMemo(() => {
    const normalizedQuery = normalizeTagSearchQuery(tagSearchQuery);
    const filtered = availableTags.filter(({ tag }) => {
      if (normalizedQuery === "") {
        return true;
      }

      const displayName = getTagDisplayName(tag).toLocaleLowerCase("ja-JP");
      return (
        displayName.includes(normalizedQuery) || tag.normalized_name.includes(normalizedQuery)
      );
    });

    return filtered.sort((left, right) => {
      if (tagSortOption === "count") {
        const countDifference = right.postCount - left.postCount;

        if (countDifference !== 0) {
          return countDifference;
        }
      }

      return getTagDisplayName(left.tag).localeCompare(getTagDisplayName(right.tag), "ja-JP");
    });
  }, [availableTags, getTagDisplayName, tagSearchQuery, tagSortOption]);

  const visibleUserOptions = useMemo(() => {
    const normalizedQuery = normalizeUserSearchQuery(userSearchQuery);

    if (normalizedQuery === "") {
      return userSummaries;
    }

    return userSummaries.filter((user) => {
      return (
        user.display_name.toLocaleLowerCase("ja-JP").includes(normalizedQuery) ||
        user.screen_name.includes(normalizedQuery)
      );
    });
  }, [userSearchQuery, userSummaries]);

  const requiredVisibleTagOptionCount = useMemo(() => {
    if (activeTagFilter === null) {
      return 0;
    }

    const index = visibleTagOptions.findIndex(
      ({ tag }) => tag.normalized_name === activeTagFilter
    );
    return index < 0 ? 0 : index + 1;
  }, [activeTagFilter, visibleTagOptions]);

  const {
    visibleItems: displayedTagOptions,
    remainingCount: remainingTagOptionCount,
    hasMore: hasMoreTagOptions,
    loadMore: loadMoreTagOptions
  } = useIncrementalList(visibleTagOptions, {
    initialCount: FILTER_MODAL_LIST_SIZE,
    step: FILTER_MODAL_LIST_SIZE,
    requiredCount: requiredVisibleTagOptionCount
  });

  const requiredVisibleUserOptionCount = useMemo(() => {
    if (activeAuthorFilter === null) {
      return 0;
    }

    const index = visibleUserOptions.findIndex((user) => user.screen_name === activeAuthorFilter);
    return index < 0 ? 0 : index + 1;
  }, [activeAuthorFilter, visibleUserOptions]);

  const {
    visibleItems: displayedUserOptions,
    remainingCount: remainingUserOptionCount,
    hasMore: hasMoreUserOptions,
    loadMore: loadMoreUserOptions
  } = useIncrementalList(visibleUserOptions, {
    initialCount: FILTER_MODAL_LIST_SIZE,
    step: FILTER_MODAL_LIST_SIZE,
    requiredCount: requiredVisibleUserOptionCount
  });

  return {
    isFilterModalOpen,
    filterModalActiveTab,
    tagSearchQuery,
    setTagSearchQuery,
    userSearchQuery,
    setUserSearchQuery,
    dateFilterDraftTarget,
    setDateFilterDraftTarget,
    dateFilterDraftFrom,
    setDateFilterDraftFrom,
    dateFilterDraftTo,
    setDateFilterDraftTo,
    dateFilterDraftError,
    tagSortOption,
    setTagSortOption,
    visibleTagOptions,
    displayedTagOptions,
    remainingTagOptionCount,
    hasMoreTagOptions,
    loadMoreTagOptions,
    visibleUserOptions,
    displayedUserOptions,
    remainingUserOptionCount,
    hasMoreUserOptions,
    loadMoreUserOptions,
    openFilterModal,
    closeFilterModal,
    resetDateFilterDraft
  };
}

function normalizeTagSearchQuery(value: string): string {
  return value.trim().toLocaleLowerCase("ja-JP");
}

function normalizeUserSearchQuery(value: string): string {
  return value.trim().replace(/^@+/, "").toLocaleLowerCase("ja-JP");
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

function getDateFilterDraftError(
  dateFrom: string,
  dateTo: string,
  language: ArchiveLanguage
): string | null {
  const normalizedDateFrom = normalizeDateInputValue(dateFrom);
  const normalizedDateTo = normalizeDateInputValue(dateTo);

  if (dateFrom !== "" && normalizedDateFrom === null) {
    return language === "ja"
      ? "開始日に有効な日付を入力してください。"
      : "Enter a valid start date.";
  }

  if (dateTo !== "" && normalizedDateTo === null) {
    return language === "ja"
      ? "終了日に有効な日付を入力してください。"
      : "Enter a valid end date.";
  }

  const fromDate = normalizedDateFrom === null ? null : parseLocalDateInput(normalizedDateFrom);
  const toDate = normalizedDateTo === null ? null : parseLocalDateInput(normalizedDateTo);

  if (fromDate === null || toDate === null) {
    return null;
  }

  if (fromDate.getTime() > toDate.getTime()) {
    return language === "ja"
      ? "開始日は終了日以前にしてください。"
      : "Start date must be before the end date.";
  }

  return null;
}
