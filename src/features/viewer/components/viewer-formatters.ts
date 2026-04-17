import type { ArchiveTagRecord } from "../../../types/archive";
import type {
  ArchiveTagSummaryRecord,
  DateFilterTarget,
  UserSummary
} from "../../../types/viewer";
import type { ArchiveLanguage } from "../../settings/archive-language";

export function formatCount(value: number, language: ArchiveLanguage = "en"): string {
  return new Intl.NumberFormat(language === "ja" ? "ja-JP" : "en-US").format(value);
}

export function formatUserSummaryLabel(user: UserSummary): string {
  return `${user.display_name} (@${user.screen_name})`;
}

export function normalizeDateInputValue(value: string): string | null {
  const trimmedValue = value.trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmedValue)) {
    return null;
  }

  return trimmedValue;
}

export function parseLocalDateInput(value: string): Date | null {
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

export function formatDateFilterTargetLabel(
  dateFilterTarget: DateFilterTarget,
  language: ArchiveLanguage
): string {
  if (dateFilterTarget === "posted_at") {
    return language === "ja" ? "投稿日時" : "Posted at";
  }

  return language === "ja" ? "保存日時" : "Saved at";
}

export function formatDateInputLabel(value: string, language: ArchiveLanguage): string {
  const date = parseLocalDateInput(value);

  if (date === null) {
    return value;
  }

  return new Intl.DateTimeFormat(language === "ja" ? "ja-JP" : "en-US", {
    dateStyle: "medium"
  }).format(date);
}

export function formatDateFilterConditionLabel(
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

export function formatEmptyArchiveMessage(input: {
  language: ArchiveLanguage;
  selectedTagFilter: ArchiveTagSummaryRecord | null;
  activeAuthorFilter: string | null;
  activeDateFilterTarget: DateFilterTarget | null;
  activeDateFrom: string | null;
  activeDateTo: string | null;
  selectedAuthorFilter: UserSummary | null;
  getTagDisplayName: (tag: ArchiveTagRecord) => string;
}): string {
  const {
    language,
    selectedTagFilter,
    activeAuthorFilter,
    activeDateFilterTarget,
    activeDateFrom,
    activeDateTo,
    selectedAuthorFilter,
    getTagDisplayName
  } = input;
  const activeFilters: string[] = [];

  if (selectedTagFilter === null && activeAuthorFilter === null && activeDateFilterTarget === null) {
    return language === "ja" ? "保存済み投稿はありません。" : "No saved posts.";
  }

  if (selectedTagFilter !== null) {
    activeFilters.push(getTagDisplayName(selectedTagFilter.tag));
  }

  if (activeAuthorFilter !== null) {
    activeFilters.push(
      selectedAuthorFilter === null
        ? `@${activeAuthorFilter}`
        : formatUserSummaryLabel(selectedAuthorFilter)
    );
  }

  if (
    activeDateFilterTarget !== null &&
    (activeDateFrom !== null || activeDateTo !== null)
  ) {
    activeFilters.push(
      formatDateFilterConditionLabel(
        activeDateFilterTarget,
        activeDateFrom,
        activeDateTo,
        language
      )
    );
  }

  return language === "ja"
    ? `次の条件に一致する保存済み投稿はありません: ${activeFilters.join(" / ")}`
    : `No saved posts match: ${activeFilters.join(" / ")}.`;
}

export function formatArchiveCountLabel(
  loadedCount: number,
  totalCount: number,
  hasMorePosts: boolean,
  language: ArchiveLanguage
): string {
  if (totalCount === 0) {
    return language === "ja" ? "表示中 0件 / 全 0件" : "Showing 0 / 0 posts";
  }

  if (hasMorePosts) {
    return language === "ja"
      ? `表示中 ${formatCount(loadedCount, language)}件 / 全 ${formatCount(totalCount, language)}件`
      : `Showing ${formatCount(loadedCount, language)} / ${formatCount(totalCount, language)} posts`;
  }

  return language === "ja"
    ? `表示中 ${formatCount(totalCount, language)}件 / 全 ${formatCount(totalCount, language)}件`
    : `Showing ${formatCount(totalCount, language)} / ${formatCount(totalCount, language)} posts`;
}
