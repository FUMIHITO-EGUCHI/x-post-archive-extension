import { useState } from "react";
import type {
  DateFilterTarget,
  PostFilterInput,
  PostSortField,
  SortDirection
} from "../../../types/viewer";
import type { LoadArchivePageInput } from "./use-archive-loader";

const DEFAULT_PAGE_SIZE = 50;
const DEFAULT_DATE_FILTER_TARGET: DateFilterTarget = "saved_at";

type LoadArchivePageFn = (input: LoadArchivePageInput) => Promise<void>;

export function useSortFilter({
  loadArchivePage,
  closeFilterModal
}: {
  loadArchivePage: LoadArchivePageFn;
  closeFilterModal: () => void;
}) {
  const [sortField, setSortField] = useState<PostSortField>("saved_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [randomSeed, setRandomSeed] = useState(() => createRandomSeed());
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  const [activeAuthorFilter, setActiveAuthorFilter] = useState<string | null>(null);
  const [activeDateFilterTarget, setActiveDateFilterTarget] =
    useState<DateFilterTarget | null>(null);
  const [activeDateFrom, setActiveDateFrom] = useState<string | null>(null);
  const [activeDateTo, setActiveDateTo] = useState<string | null>(null);

  function getCurrentDateFilterInput() {
    return {
      dateFilterTarget: activeDateFilterTarget,
      dateFrom: activeDateFrom,
      dateTo: activeDateTo
    };
  }

  function getCurrentPostFilterInput(): PostFilterInput {
    return {
      tagFilter: activeTagFilter,
      authorFilter: activeAuthorFilter,
      dateFilterTarget: activeDateFilterTarget,
      dateFrom: toDateFilterStartTimestamp(activeDateFrom),
      dateTo: toDateFilterEndTimestamp(activeDateTo)
    };
  }

  function getRandomSeedInput(nextSortField = sortField, seedOverride?: number | null) {
    return {
      randomSeed:
        nextSortField === "random" ? seedOverride ?? randomSeed : null
    };
  }

  async function handleSortFieldChange(nextValue: PostSortField) {
    const nextRandomSeed = nextValue === "random" ? createRandomSeed() : randomSeed;
    setSortField(nextValue);
    if (nextValue === "random") {
      setRandomSeed(nextRandomSeed);
    }
    window.scrollTo({
      top: 0
    });
    await loadArchivePage({
      offset: 0,
      limit: DEFAULT_PAGE_SIZE,
      sortField: nextValue,
      sortDirection,
      ...getRandomSeedInput(nextValue, nextRandomSeed),
      tagFilter: activeTagFilter,
      authorFilter: activeAuthorFilter,
      ...getCurrentDateFilterInput(),
      append: false
    });
  }

  async function handleSortDirectionToggle() {
    if (sortField === "random") {
      return;
    }

    const nextValue = sortDirection === "desc" ? "asc" : "desc";
    setSortDirection(nextValue);
    window.scrollTo({
      top: 0
    });
    await loadArchivePage({
      offset: 0,
      limit: DEFAULT_PAGE_SIZE,
      sortField,
      sortDirection: nextValue,
      ...getRandomSeedInput(),
      tagFilter: activeTagFilter,
      authorFilter: activeAuthorFilter,
      ...getCurrentDateFilterInput(),
      append: false
    });
  }

  async function handleReshuffle() {
    const nextRandomSeed = createRandomSeed();
    setRandomSeed(nextRandomSeed);
    window.scrollTo({
      top: 0
    });
    await loadArchivePage({
      offset: 0,
      limit: DEFAULT_PAGE_SIZE,
      sortField: "random",
      sortDirection,
      ...getRandomSeedInput("random", nextRandomSeed),
      tagFilter: activeTagFilter,
      authorFilter: activeAuthorFilter,
      ...getCurrentDateFilterInput(),
      append: false
    });
  }

  async function handleToggleTagFilter(normalizedName: string) {
    const nextValue = activeTagFilter === normalizedName ? null : normalizedName;

    setActiveTagFilter(nextValue);
    closeFilterModal();
    window.scrollTo({
      top: 0
    });
    await loadArchivePage({
      offset: 0,
      limit: DEFAULT_PAGE_SIZE,
      sortField,
      sortDirection,
      ...getRandomSeedInput(),
      tagFilter: nextValue,
      authorFilter: activeAuthorFilter,
      ...getCurrentDateFilterInput(),
      append: false
    });
  }

  async function handleToggleAuthorFilter(screenName: string) {
    const nextValue = activeAuthorFilter === screenName ? null : screenName;

    setActiveAuthorFilter(nextValue);
    closeFilterModal();
    window.scrollTo({
      top: 0
    });
    await loadArchivePage({
      offset: 0,
      limit: DEFAULT_PAGE_SIZE,
      sortField,
      sortDirection,
      ...getRandomSeedInput(),
      tagFilter: activeTagFilter,
      authorFilter: nextValue,
      ...getCurrentDateFilterInput(),
      append: false
    });
  }

  async function handleApplyDateFilter({
    dateFilterTarget,
    dateFrom,
    dateTo
  }: {
    dateFilterTarget: DateFilterTarget | null;
    dateFrom: string | null;
    dateTo: string | null;
  }) {
    setActiveDateFilterTarget(dateFilterTarget);
    setActiveDateFrom(dateFrom);
    setActiveDateTo(dateTo);
    closeFilterModal();
    window.scrollTo({
      top: 0
    });
    await loadArchivePage({
      offset: 0,
      limit: DEFAULT_PAGE_SIZE,
      sortField,
      sortDirection,
      ...getRandomSeedInput(),
      tagFilter: activeTagFilter,
      authorFilter: activeAuthorFilter,
      dateFilterTarget,
      dateFrom,
      dateTo,
      append: false
    });
  }

  async function handleClearDateFilter() {
    setActiveDateFilterTarget(null);
    setActiveDateFrom(null);
    setActiveDateTo(null);
    closeFilterModal();
    window.scrollTo({
      top: 0
    });
    await loadArchivePage({
      offset: 0,
      limit: DEFAULT_PAGE_SIZE,
      sortField,
      sortDirection,
      ...getRandomSeedInput(),
      tagFilter: activeTagFilter,
      authorFilter: activeAuthorFilter,
      dateFilterTarget: null,
      dateFrom: null,
      dateTo: null,
      append: false
    });
  }

  async function handleClearAllFilters() {
    setActiveAuthorFilter(null);
    setActiveTagFilter(null);
    setActiveDateFilterTarget(null);
    setActiveDateFrom(null);
    setActiveDateTo(null);
    closeFilterModal();
    window.scrollTo({
      top: 0
    });
    await loadArchivePage({
      offset: 0,
      limit: DEFAULT_PAGE_SIZE,
      sortField,
      sortDirection,
      ...getRandomSeedInput(),
      tagFilter: null,
      authorFilter: null,
      dateFilterTarget: null,
      dateFrom: null,
      dateTo: null,
      append: false
    });
  }

  async function handleLoadMore(currentPostCount: number) {
    await loadArchivePage({
      offset: currentPostCount,
      limit: DEFAULT_PAGE_SIZE,
      sortField,
      sortDirection,
      ...getRandomSeedInput(),
      tagFilter: activeTagFilter,
      authorFilter: activeAuthorFilter,
      ...getCurrentDateFilterInput(),
      append: true
    });
  }

  return {
    sortField,
    setSortField,
    sortDirection,
    setSortDirection,
    randomSeed,
    setRandomSeed,
    activeTagFilter,
    setActiveTagFilter,
    activeAuthorFilter,
    setActiveAuthorFilter,
    activeDateFilterTarget,
    setActiveDateFilterTarget,
    activeDateFrom,
    setActiveDateFrom,
    activeDateTo,
    setActiveDateTo,
    getCurrentDateFilterInput,
    getCurrentPostFilterInput,
    getRandomSeedInput,
    handleSortFieldChange,
    handleSortDirectionToggle,
    handleReshuffle,
    handleToggleTagFilter,
    handleToggleAuthorFilter,
    handleApplyDateFilter,
    handleClearDateFilter,
    handleClearAllFilters,
    handleLoadMore
  };
}

export function createRandomSeed(): number {
  const seed = new Uint32Array(1);
  globalThis.crypto.getRandomValues(seed);
  const nextSeed = seed[0];
  return nextSeed === undefined || nextSeed === 0 ? 1 : nextSeed;
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

function toDateFilterStartTimestamp(value: string | null): number | null {
  if (value === null) {
    return null;
  }

  return parseLocalDateInput(value)?.getTime() ?? null;
}

function toDateFilterEndTimestamp(value: string | null): number | null {
  if (value === null) {
    return null;
  }

  const date = parseLocalDateInput(value);

  if (date === null) {
    return null;
  }

  date.setHours(23, 59, 59, 999);
  return date.getTime();
}

export { DEFAULT_DATE_FILTER_TARGET };
