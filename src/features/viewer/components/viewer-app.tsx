import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  ArchivePostRecord,
  ArchiveSettings,
  ArchiveTagRecord
} from "../../../types/archive";
import { defaultArchiveSettings } from "../../../types/archive";
import type {
  ArchiveSummaryRecord,
  ArchiveTagSummaryRecord,
  DateFilterTarget,
  FontSizeOption,
  ListPostsPageInput,
  PostFilterInput,
  PostSortField,
  StorageEstimateState,
  SortDirection,
  UserSummary,
  ViewerSessionRestoreMode
} from "../../../types/viewer";
import type { ViewerTheme } from "../../../types/viewer";
import {
  requestAddPostTagByName,
  requestArchiveSummary,
  requestDeletePost,
  requestPostsPage,
  requestRemovePostTagByName,
  requestTagSummaries,
  requestUserSummaries
} from "../../runtime/client";
import { createLogger } from "../../logging/logger";
import { BulkTagModal } from "./bulk-tag-modal";
import {
  loadArchiveLanguage,
  localizeKnownAutoTagDisplayName,
  persistArchiveLanguage,
  type ArchiveLanguage
} from "../../settings/archive-language";
import {
  loadArchiveSettings,
  persistArchiveSettings
} from "../../settings/archive-settings";
import { loadViewerTheme, persistViewerTheme } from "../../settings/viewer-theme";
import {
  clearViewerSession,
  loadViewerSession,
  loadViewerSessionRestoreMode,
  persistViewerSession,
  persistViewerSessionRestoreMode
} from "../viewer-session-storage";
import { useIncrementalList } from "./use-incremental-list";
import {
  StickyToolbar,
  type FilterModalTab,
  type StickyToolbarFilterChip
} from "./sticky-toolbar";
import { UnifiedFilterModal } from "./unified-filter-modal";
import { PostCard } from "./post-card";
import { SettingsScreen } from "./settings-screen";
import {
  ImageLightboxDialog,
  VideoLightboxDialog,
  useMediaLightbox
} from "./media-lightbox";
import { useRefetchControls } from "./use-refetch-controls";

type ViewerStatus = "idle" | "loading" | "ready";
type ViewerScreen = "archive" | "settings";
type TagSortOption = "count" | "name";
const VIEWER_FONT_SIZE_STORAGE_KEY = "viewer.fontSize";
const DEFAULT_PAGE_SIZE = 50;
const MAX_SESSION_RESTORE_LIMIT = 200;
const FONT_SIZE_SCALE: Record<FontSizeOption, number> = {
  small: 0.92,
  medium: 1,
  large: 1.12
};
const FILTER_MODAL_LIST_SIZE = 40;
const DEFAULT_DATE_FILTER_TARGET: DateFilterTarget = "saved_at";
const logger = createLogger("viewer");

export function ViewerApp() {
  const [screen, setScreen] = useState<ViewerScreen>("archive");
  const [language, setLanguage] = useState<ArchiveLanguage>("ja");
  const [archiveSettings, setArchiveSettings] =
    useState<ArchiveSettings>(defaultArchiveSettings);
  const [viewerTheme, setViewerTheme] = useState<ViewerTheme>("light");
  const [fontSize, setFontSize] = useState<FontSizeOption>("medium");
  const [sessionRestoreMode, setSessionRestoreMode] =
    useState<ViewerSessionRestoreMode>("filters");
  const [posts, setPosts] = useState<ArchivePostRecord[]>([]);
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
  const [archiveTotalCount, setArchiveTotalCount] = useState(0);
  const [hasMorePosts, setHasMorePosts] = useState(false);
  const [sortField, setSortField] = useState<PostSortField>("saved_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [randomSeed, setRandomSeed] = useState(() => createRandomSeed());
  const [status, setStatus] = useState<ViewerStatus>("idle");
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [loadNotice, setLoadNotice] = useState<string | null>(null);
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  const [activeAuthorFilter, setActiveAuthorFilter] = useState<string | null>(null);
  const [activeDateFilterTarget, setActiveDateFilterTarget] = useState<DateFilterTarget | null>(null);
  const [activeDateFrom, setActiveDateFrom] = useState<string | null>(null);
  const [activeDateTo, setActiveDateTo] = useState<string | null>(null);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [filterModalActiveTab, setFilterModalActiveTab] = useState<FilterModalTab>("user");
  const [isBulkTagModalOpen, setIsBulkTagModalOpen] = useState(false);
  const [tagSearchQuery, setTagSearchQuery] = useState("");
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [dateFilterDraftTarget, setDateFilterDraftTarget] =
    useState<DateFilterTarget>(DEFAULT_DATE_FILTER_TARGET);
  const [dateFilterDraftFrom, setDateFilterDraftFrom] = useState("");
  const [dateFilterDraftTo, setDateFilterDraftTo] = useState("");
  const [tagSortOption, setTagSortOption] = useState<TagSortOption>("count");
  const [userSummaries, setUserSummaries] = useState<UserSummary[]>([]);
  const [tagActionPostId, setTagActionPostId] = useState<string | null>(null);
  const [tagPickerPostId, setTagPickerPostId] = useState<string | null>(null);
  const [storageEstimate, setStorageEstimate] = useState<StorageEstimateState>({
    usage: null,
    quota: null,
    available: null,
    status: "idle"
  });
  const mediaLightbox = useMediaLightbox();
  const loadArchiveRequestIdRef = useRef(0);
  const shouldPersistSessionRef = useRef(false);
  const restoreScrollTopRef = useRef<number | null>(null);
  const [restoreTargetPostId, setRestoreTargetPostId] = useState<string | null>(null);
  const archiveSectionRef = useRef<HTMLElement | null>(null);
  const settingsButtonRef = useRef<HTMLButtonElement | null>(null);
  const backToArchiveButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousScreenRef = useRef<ViewerScreen>("archive");

  const viewerScale = FONT_SIZE_SCALE[fontSize];
  const refetchControls = useRefetchControls({
    language,
    onRefetchComplete: refreshArchive,
    setLoadNotice
  });
  const {
    refetchStatus,
    handleRefetchPost,
    handleRefetchAllPosts,
    handleRefetchZeroEngagementPosts,
    handleCancelRefetch,
    handleClearRefetchQueue
  } = refetchControls;

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", viewerTheme);
  }, [viewerTheme]);

  useEffect(() => {
    if (screen === "settings") {
      window.requestAnimationFrame(() => {
        backToArchiveButtonRef.current?.focus();
      });
    } else if (previousScreenRef.current === "settings") {
      window.requestAnimationFrame(() => {
        settingsButtonRef.current?.focus();
      });
    }

    previousScreenRef.current = screen;
  }, [screen]);

  const selectedTagFilter = useMemo(
    () => availableTags.find(({ tag }) => tag.normalized_name === activeTagFilter) ?? null,
    [activeTagFilter, availableTags]
  );
  const selectedAuthorFilter = useMemo(
    () => userSummaries.find((user) => user.screen_name === activeAuthorFilter) ?? null,
    [activeAuthorFilter, userSummaries]
  );
  const hasActiveDateFilter =
    activeDateFilterTarget !== null && (activeDateFrom !== null || activeDateTo !== null);
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

  function closeBulkTagModal() {
    setIsBulkTagModalOpen(false);
  }

  useEffect(() => {
    if (tagPickerPostId === null) {
      return;
    }

    if (!posts.some((post) => post.x_post_id === tagPickerPostId)) {
      setTagPickerPostId(null);
    }
  }, [posts, tagPickerPostId]);

  function getTagDisplayName(tag: ArchiveTagRecord): string {
    if (tag.source !== "auto") {
      return tag.display_name;
    }

    return localizeKnownAutoTagDisplayName(
      language,
      tag.system_key ?? null,
      tag.normalized_name,
      tag.display_name
    );
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
  }, [availableTags, language, tagSearchQuery, tagSortOption]);

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

  useEffect(() => {
    let cancelled = false;

    async function initializeViewer() {
      try {
        const [
          storedFont,
          nextLanguage,
          nextArchiveSettings,
          nextSessionRestoreMode,
          nextTheme,
          savedSession
        ] = await Promise.all([
          browser.storage.local.get(VIEWER_FONT_SIZE_STORAGE_KEY),
          loadArchiveLanguage(),
          loadArchiveSettings(),
          loadViewerSessionRestoreMode(),
          loadViewerTheme(),
          loadViewerSession()
        ]);

        if (cancelled) {
          return;
        }

        const storedFontValue = storedFont[VIEWER_FONT_SIZE_STORAGE_KEY];

        if (isFontSizeOption(storedFontValue)) {
          setFontSize(storedFontValue);
        }

        setLanguage(nextLanguage);
        setArchiveSettings(nextArchiveSettings);
        setSessionRestoreMode(nextSessionRestoreMode);
        setViewerTheme(nextTheme);

        let nextSortField: PostSortField = "saved_at";
        let nextSortDirection: SortDirection = "desc";
        let nextRandomSeed = createRandomSeed();
        let nextTagFilter: string | null = null;
        let nextAuthorFilter: string | null = null;
        let nextDateFilterTarget: DateFilterTarget | null = null;
        let nextDateFrom: string | null = null;
        let nextDateTo: string | null = null;
        let initialLimit = DEFAULT_PAGE_SIZE;

        if (nextSessionRestoreMode !== "off" && savedSession !== null) {
          nextSortField = savedSession.sortField;
          nextSortDirection = savedSession.sortDirection;
          nextTagFilter = savedSession.activeTagFilter;
          nextAuthorFilter = savedSession.activeAuthorFilter ?? null;
          nextDateFilterTarget = savedSession.activeDateFilterTarget ?? null;
          nextDateFrom = savedSession.activeDateFrom ?? null;
          nextDateTo = savedSession.activeDateTo ?? null;

          if (nextSessionRestoreMode === "filters-and-position" && nextSortField !== "random") {
            initialLimit = Math.min(
              Math.max(DEFAULT_PAGE_SIZE, savedSession.loadedCount),
              MAX_SESSION_RESTORE_LIMIT
            );
            restoreScrollTopRef.current = savedSession.scrollTop;
            setRestoreTargetPostId(savedSession.anchorPostId);
          }
        }

        setSortField(nextSortField);
        setSortDirection(nextSortDirection);
        setRandomSeed(nextRandomSeed);
        setActiveTagFilter(nextTagFilter);
        setActiveAuthorFilter(nextAuthorFilter);
        setActiveDateFilterTarget(nextDateFilterTarget);
        setActiveDateFrom(nextDateFrom);
        setActiveDateTo(nextDateTo);
        setDateFilterDraftTarget(nextDateFilterTarget ?? DEFAULT_DATE_FILTER_TARGET);
        setDateFilterDraftFrom(nextDateFrom ?? "");
        setDateFilterDraftTo(nextDateTo ?? "");

        await Promise.all([
          refreshArchiveMetadata(),
          loadArchivePage({
            offset: 0,
            limit: initialLimit,
            sortField: nextSortField,
            sortDirection: nextSortDirection,
            randomSeed: nextSortField === "random" ? nextRandomSeed : null,
            tagFilter: nextTagFilter,
            authorFilter: nextAuthorFilter,
            dateFilterTarget: nextDateFilterTarget,
            dateFrom: nextDateFrom,
            dateTo: nextDateTo,
            append: false
          })
        ]);

        if (!cancelled) {
          shouldPersistSessionRef.current = true;
        }
      } catch (error) {
        logger.error("viewer.initialize.failed", {
          message: "Failed to initialize the viewer.",
          context: {
            error
          }
        });

        if (!cancelled) {
          setPosts([]);
          setStatus("ready");
          setLoadNotice("Posts could not be loaded. Showing an empty list.");
        }
      }
    }

    void initializeViewer();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadStorageEstimate() {
      if (typeof navigator.storage?.estimate !== "function") {
        if (!cancelled) {
          setStorageEstimate({
            usage: null,
            quota: null,
            available: null,
            status: "unsupported"
          });
        }

        return;
      }

      try {
        const result = await navigator.storage.estimate();
        const usage = typeof result.usage === "number" ? result.usage : null;
        const quota = typeof result.quota === "number" ? result.quota : null;

        if (!cancelled) {
          setStorageEstimate({
            usage,
            quota,
            available: usage !== null && quota !== null ? Math.max(quota - usage, 0) : null,
            status: "ready"
          });
        }
      } catch (error) {
        logger.warn("storage.estimate.unavailable", {
          message: "Storage estimate is unavailable.",
          context: {
            error
          }
        });

        if (!cancelled) {
          setStorageEstimate({
            usage: null,
            quota: null,
            available: null,
            status: "unsupported"
          });
        }
      }
    }

    void loadStorageEstimate();

    return () => {
      cancelled = true;
    };
  }, [archiveSummary.mediaBytes, archiveSummary.postCount]);

  useEffect(() => {
    if (restoreTargetPostId === null && restoreScrollTopRef.current === null) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const targetElement =
        restoreTargetPostId === null ? null : findPostCardElement(restoreTargetPostId);

      if (targetElement !== null) {
        targetElement.scrollIntoView({
          block: "start"
        });
      } else if (restoreScrollTopRef.current !== null) {
        window.scrollTo({
          top: restoreScrollTopRef.current
        });
      }

      restoreScrollTopRef.current = null;
      setRestoreTargetPostId(null);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [posts, restoreTargetPostId]);

  useEffect(() => {
    if (!shouldPersistSessionRef.current || screen !== "archive") {
      return;
    }

    if (sessionRestoreMode === "off") {
      void clearViewerSession();
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void persistCurrentViewerSession();
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    activeAuthorFilter,
    activeDateFilterTarget,
    activeDateFrom,
    activeDateTo,
    activeTagFilter,
    posts.length,
    screen,
    sessionRestoreMode,
    sortDirection,
    sortField
  ]);

  useEffect(() => {
    if (
      !shouldPersistSessionRef.current ||
      sessionRestoreMode !== "filters-and-position" ||
      screen !== "archive"
    ) {
      return undefined;
    }

    let timeoutId: number | null = null;

    function handleScroll() {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }

      timeoutId = window.setTimeout(() => {
        void persistCurrentViewerSession();
      }, 300);
    }

    window.addEventListener("scroll", handleScroll, {
      passive: true
    });

    return () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }

      window.removeEventListener("scroll", handleScroll);
    };
  }, [
    activeAuthorFilter,
    activeDateFilterTarget,
    activeDateFrom,
    activeDateTo,
    activeTagFilter,
    posts.length,
    screen,
    sessionRestoreMode,
    sortDirection,
    sortField
  ]);

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
        context: {
          error
        }
      });
    }
  }

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

  async function loadArchivePage(input: {
    offset: number;
    limit: number;
    sortField: PostSortField;
    sortDirection: SortDirection;
    randomSeed: number | null;
    tagFilter: string | null;
    authorFilter: string | null;
    dateFilterTarget: DateFilterTarget | null;
    dateFrom: string | null;
    dateTo: string | null;
    append: boolean;
  }): Promise<void> {
    const requestId = (loadArchiveRequestIdRef.current += 1);

    if (input.append) {
      setIsLoadingMore(true);
    } else {
      setStatus("loading");
    }

    setLoadNotice(null);

    try {
      const response = await requestPostsPage({
        offset: input.offset,
        limit: input.limit,
        sortField: input.sortField,
        sortDirection: input.sortDirection,
        randomSeed: input.randomSeed,
        tagFilter: input.tagFilter,
        authorFilter: input.authorFilter,
        ...buildDateFilterRequest(input.dateFilterTarget, input.dateFrom, input.dateTo)
      });

      if (requestId !== loadArchiveRequestIdRef.current) {
        return;
      }

      if (input.append) {
        setPosts((current) => [...current, ...response.posts]);
      } else {
        setPosts(response.posts);
      }

      setArchiveTotalCount(response.totalCount);
      setHasMorePosts(response.hasMore);
      setStatus("ready");
    } catch (error) {
      if (requestId !== loadArchiveRequestIdRef.current) {
        return;
      }

      logger.error(input.append ? "posts.load_more.failed" : "posts.load.failed", {
        message: input.append ? "Failed to load more posts." : "Failed to load posts.",
        context: {
          error,
          offset: input.offset,
          limit: input.limit,
          append: input.append
        }
      });

      if (!input.append) {
        setPosts([]);
        setArchiveTotalCount(0);
        setHasMorePosts(false);
      }

      setStatus("ready");
      setLoadNotice(
        input.append
          ? "More posts could not be loaded."
          : "Posts could not be loaded. Showing an empty list."
      );
    } finally {
      if (input.append) {
        setIsLoadingMore(false);
      }
    }
  }

  async function reloadCurrentArchive(limit = Math.max(posts.length, DEFAULT_PAGE_SIZE)) {
    await Promise.all([
      refreshArchiveMetadata(),
      loadArchivePage({
        offset: 0,
        limit,
        sortField,
        sortDirection,
        ...getRandomSeedInput(),
        tagFilter: activeTagFilter,
        authorFilter: activeAuthorFilter,
        ...getCurrentDateFilterInput(),
        append: false
      })
    ]);
  }

  async function refreshArchive(): Promise<void> {
    await reloadCurrentArchive();
  }

  async function handleTagRenamed(
    oldNormalizedName: string,
    newNormalizedName: string
  ): Promise<void> {
    const nextTagFilter =
      activeTagFilter === oldNormalizedName ? newNormalizedName : activeTagFilter;

    if (nextTagFilter !== activeTagFilter) {
      setActiveTagFilter(nextTagFilter);
    }

    await Promise.all([
      refreshArchiveMetadata(),
      loadArchivePage({
        offset: 0,
        limit: Math.max(posts.length, DEFAULT_PAGE_SIZE),
        sortField,
        sortDirection,
        ...getRandomSeedInput(),
        tagFilter: nextTagFilter,
        authorFilter: activeAuthorFilter,
        ...getCurrentDateFilterInput(),
        append: false
      })
    ]);
  }

  async function handleTagMerged(
    sourceNormalizedName: string,
    targetNormalizedName: string
  ): Promise<void> {
    const nextTagFilter =
      activeTagFilter === sourceNormalizedName ? targetNormalizedName : activeTagFilter;

    if (nextTagFilter !== activeTagFilter) {
      setActiveTagFilter(nextTagFilter);
    }

    await Promise.all([
      refreshArchiveMetadata(),
      loadArchivePage({
        offset: 0,
        limit: Math.max(posts.length, DEFAULT_PAGE_SIZE),
        sortField,
        sortDirection,
        ...getRandomSeedInput(),
        tagFilter: nextTagFilter,
        authorFilter: activeAuthorFilter,
        ...getCurrentDateFilterInput(),
        append: false
      })
    ]);
  }

  async function handleDelete(xPostId: string) {
    setDeletingId(xPostId);

    try {
      const response = await requestDeletePost(xPostId);

      if (response.deleted) {
        await reloadCurrentArchive();
      }
    } catch (error) {
      logger.error("post.delete.failed", {
        message: "Failed to delete post.",
        context: {
          xPostId,
          error
        }
      });
    } finally {
      setDeletingId(null);
    }
  }

  async function handleAddTagToPost(xPostId: string, displayName: string) {
    if (displayName.trim() === "") {
      return;
    }

    setTagActionPostId(xPostId);

    try {
      await requestAddPostTagByName(xPostId, displayName);
      await reloadCurrentArchive();
    } catch (error) {
      logger.error("post.tags.add.failed", {
        message: "Failed to add tag.",
        context: {
          xPostId,
          displayName,
          error
        }
      });
    } finally {
      setTagActionPostId(null);
    }
  }

  async function handleRemoveTagFromPost(xPostId: string, normalizedName: string) {
    setTagActionPostId(xPostId);

    try {
      await requestRemovePostTagByName(xPostId, normalizedName);
      await reloadCurrentArchive();
    } catch (error) {
      logger.error("post.tags.remove.failed", {
        message: "Failed to remove tag.",
        context: {
          xPostId,
          normalizedTagName: normalizedName,
          error
        }
      });
    } finally {
      setTagActionPostId(null);
    }
  }

  async function handleSessionRestoreModeChange(nextValue: ViewerSessionRestoreMode) {
    setSessionRestoreMode(nextValue);

    try {
      await persistViewerSessionRestoreMode(nextValue);

      if (nextValue === "off") {
        await clearViewerSession();
        return;
      }

      await persistCurrentViewerSession({
        anchorPostId: nextValue === "filters-and-position" ? findCurrentAnchorPostId() : null,
        scrollTop: nextValue === "filters-and-position" ? window.scrollY : 0
      });
    } catch (error) {
      logger.error("viewer.session_restore_mode.persist_failed", {
        message: "Failed to persist the session restore preference.",
        context: {
          nextValue,
          error
        }
      });
    }
  }

  async function handleClearSavedSession() {
    try {
      await clearViewerSession();
    } catch (error) {
      logger.error("viewer.session.clear_failed", {
        message: "Failed to clear the saved viewer session.",
        context: {
          error
        }
      });
    }
  }

  async function handleFontSizeChange(nextValue: FontSizeOption) {
    setFontSize(nextValue);

    try {
      await browser.storage.local.set({
        [VIEWER_FONT_SIZE_STORAGE_KEY]: nextValue
      });
    } catch (error) {
      logger.error("viewer.font_size.persist_failed", {
        message: "Failed to persist viewer font size.",
        context: {
          nextValue,
          error
        }
      });
    }
  }

  async function handleLanguageChange(nextValue: ArchiveLanguage) {
    setLanguage(nextValue);

    try {
      await persistArchiveLanguage(nextValue);
    } catch (error) {
      logger.error("viewer.language.persist_failed", {
        message: "Failed to persist archive language.",
        context: {
          nextValue,
          error
        }
      });
    }
  }

  async function handleThemeChange(nextValue: ViewerTheme) {
    setViewerTheme(nextValue);

    try {
      await persistViewerTheme(nextValue);
    } catch (error) {
      logger.error("viewer.theme.persist_failed", {
        message: "Failed to persist viewer theme.",
        context: {
          nextValue,
          error
        }
      });
    }
  }

  async function handleArchiveSettingsChange(nextValue: ArchiveSettings) {
    setArchiveSettings(nextValue);

    try {
      await persistArchiveSettings(nextValue);
    } catch (error) {
      logger.error("viewer.archive_settings.persist_failed", {
        message: "Failed to persist archive settings.",
        context: {
          nextValue,
          error
        }
      });
    }
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

  async function handleApplyDateFilter() {
    const validationError = getDateFilterDraftError(dateFilterDraftFrom, dateFilterDraftTo, language);

    if (validationError !== null) {
      return;
    }

    const nextDateFrom = normalizeDateInputValue(dateFilterDraftFrom);
    const nextDateTo = normalizeDateInputValue(dateFilterDraftTo);
    const nextDateFilterTarget =
      nextDateFrom === null && nextDateTo === null ? null : dateFilterDraftTarget;

    setActiveDateFilterTarget(nextDateFilterTarget);
    setActiveDateFrom(nextDateFrom);
    setActiveDateTo(nextDateTo);
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
      dateFilterTarget: nextDateFilterTarget,
      dateFrom: nextDateFrom,
      dateTo: nextDateTo,
      append: false
    });
  }

  async function handleClearDateFilter() {
    setActiveDateFilterTarget(null);
    setActiveDateFrom(null);
    setActiveDateTo(null);
    setDateFilterDraftTarget(DEFAULT_DATE_FILTER_TARGET);
    setDateFilterDraftFrom("");
    setDateFilterDraftTo("");
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
    setDateFilterDraftTarget(DEFAULT_DATE_FILTER_TARGET);
    setDateFilterDraftFrom("");
    setDateFilterDraftTo("");
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

  async function handleLoadMore() {
    await loadArchivePage({
      offset: posts.length,
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

  async function persistCurrentViewerSession(overrides?: {
    anchorPostId?: string | null;
    scrollTop?: number;
  }) {
    if (sessionRestoreMode === "off") {
      return;
    }

    try {
      await persistViewerSession({
        version: 1,
        sortField,
        sortDirection,
        activeTagFilter,
        activeAuthorFilter,
        activeDateFilterTarget,
        activeDateFrom,
        activeDateTo,
        loadedCount: posts.length,
        anchorPostId:
          sessionRestoreMode === "filters-and-position"
            ? overrides?.anchorPostId ?? findCurrentAnchorPostId()
            : null,
        scrollTop:
          sessionRestoreMode === "filters-and-position"
            ? overrides?.scrollTop ?? window.scrollY
            : 0,
        savedAt: Date.now()
      });
    } catch (error) {
      logger.error("viewer.session.persist_failed", {
        message: "Failed to persist the viewer session.",
        context: {
          error
        }
      });
    }
  }

  const filterChips: StickyToolbarFilterChip[] = [];

  if (activeAuthorFilter !== null) {
    filterChips.push({
      key: "user"
    });
  }

  if (selectedTagFilter !== null) {
    filterChips.push({
      key: "tag"
    });
  }

  if (hasActiveDateFilter) {
    filterChips.push({
      key: "date"
    });
  }

  const firstActiveFilterTab: FilterModalTab =
    activeAuthorFilter !== null
      ? "user"
      : selectedTagFilter !== null
        ? "tag"
        : hasActiveDateFilter
          ? "date"
          : "user";

  return (
    <main
      className="viewer-shell"
      lang={language === "ja" ? "ja" : "en"}
      style={
        {
          "--viewer-font-scale": viewerScale
        } as CSSProperties
      }
    >
      {screen === "archive" ? (
        <>
          <StickyToolbar
            countLabel={formatArchiveCountLabel(
              posts.length,
              archiveTotalCount,
              hasMorePosts,
              language
            )}
            filterChips={filterChips}
            firstActiveFilterTab={firstActiveFilterTab}
            isBulkTagDisabled={status !== "ready" || archiveTotalCount === 0}
            language={language}
            onOpenBulkTag={() => {
              setIsBulkTagModalOpen(true);
            }}
            onClearAllFilters={() => {
              void handleClearAllFilters();
            }}
            onOpenFilter={openFilterModal}
            onOpenSettings={() => {
              setScreen("settings");
            }}
            onReshuffle={() => {
              void handleReshuffle();
            }}
            onSortDirectionToggle={() => {
              void handleSortDirectionToggle();
            }}
            onSortFieldChange={(field) => {
              void handleSortFieldChange(field);
            }}
            settingsButtonRef={settingsButtonRef}
            sortDirection={sortDirection}
            sortField={sortField}
          />

          <section className="viewer-list-panel" ref={archiveSectionRef}>
            <h2 className="viewer-visually-hidden">{language === "ja" ? "一覧" : "Archive"}</h2>

            {status === "loading" && (
              <p className="viewer-message">
                {language === "ja" ? "保存済み投稿を読み込み中..." : "Loading saved posts..."}
              </p>
            )}
            {loadNotice !== null && (
              <p className="viewer-message viewer-message-error">{loadNotice}</p>
            )}
            {status === "ready" && posts.length === 0 && (
              <p className="viewer-message">
                {formatEmptyArchiveMessage({
                  language,
                  selectedTagFilter,
                  activeAuthorFilter,
                  activeDateFilterTarget,
                  activeDateFrom,
                  activeDateTo,
                  selectedAuthorFilter,
                  getTagDisplayName
                })}
              </p>
            )}

            {posts.length > 0 && (
              <div className="viewer-list">
                {posts.map((post) => (
                  <PostCard
                    key={post.x_post_id}
                    post={post}
                    language={language}
                    deletingId={deletingId}
                    tagActionPostId={tagActionPostId}
                    tagPickerPostId={tagPickerPostId}
                    refetchCurrentPostId={refetchStatus.currentPostId}
                    availableTags={availableTags}
                    getTagDisplayName={getTagDisplayName}
                    onDelete={(xPostId) => {
                      void handleDelete(xPostId);
                    }}
                    onRefetch={(xPostId) => {
                      void handleRefetchPost(xPostId);
                    }}
                    onToggleTagFilter={(normalizedName) => {
                      void handleToggleTagFilter(normalizedName);
                    }}
                    onOpenMedia={(items, currentIndex) => {
                      mediaLightbox.setActiveMedia({
                        items,
                        currentIndex
                      });
                    }}
                    onOpenVideo={(media) => {
                      mediaLightbox.setActiveVideo({
                        media,
                        objectUrl: null,
                        status: "loading"
                      });
                    }}
                    onToggleTagPicker={(xPostId) => {
                      setTagPickerPostId((current) => (current === xPostId ? null : xPostId));
                    }}
                    onCloseTagPicker={() => {
                      setTagPickerPostId(null);
                    }}
                    onAddTag={handleAddTagToPost}
                    onRemoveTag={handleRemoveTagFromPost}
                  />
                ))}
              </div>
            )}

            {hasMorePosts && (
              <div className="viewer-list-footer">
                <button
                  className="viewer-action-button"
                  type="button"
                  onClick={() => {
                    void handleLoadMore();
                  }}
                  disabled={isLoadingMore}
                >
                  {isLoadingMore
                    ? language === "ja"
                      ? "読み込み中..."
                      : "Loading..."
                    : language === "ja"
                      ? "さらに読み込む"
                      : "Load more"}
                </button>
              </div>
            )}
          </section>
        </>
      ) : (
        <SettingsScreen
          language={language}
          archiveSettings={archiveSettings}
          viewerTheme={viewerTheme}
          fontSize={fontSize}
          sessionRestoreMode={sessionRestoreMode}
          storageEstimate={storageEstimate}
          archiveSummary={archiveSummary}
          refetchStatus={refetchStatus}
          backToArchiveButtonRef={backToArchiveButtonRef}
          onBackToArchive={() => {
            setScreen("archive");
          }}
          onArchiveSettingsChange={handleArchiveSettingsChange}
          onThemeChange={handleThemeChange}
          onLanguageChange={handleLanguageChange}
          onFontSizeChange={handleFontSizeChange}
          onSessionRestoreModeChange={handleSessionRestoreModeChange}
          onClearSavedSession={handleClearSavedSession}
          onTagRenamed={handleTagRenamed}
          onTagMerged={handleTagMerged}
          onRefetchAll={handleRefetchAllPosts}
          onRefetchZeroEngagement={handleRefetchZeroEngagementPosts}
          onRefetchCancel={handleCancelRefetch}
          onRefetchClear={handleClearRefetchQueue}
          onArchiveChanged={refreshArchive}
        />
      )}

      {isFilterModalOpen && (
        <UnifiedFilterModal
          activeAuthorFilter={activeAuthorFilter}
          activeDateFilterTarget={activeDateFilterTarget}
          activeDateFrom={activeDateFrom}
          activeDateTo={activeDateTo}
          activeTagFilter={activeTagFilter}
          archiveTotalCount={archiveTotalCount}
          dateFilterDraftError={dateFilterDraftError}
          dateFilterDraftFrom={dateFilterDraftFrom}
          dateFilterDraftTarget={dateFilterDraftTarget}
          dateFilterDraftTo={dateFilterDraftTo}
          displayedTagOptions={displayedTagOptions}
          displayedUserOptions={displayedUserOptions}
          getTagDisplayName={getTagDisplayName}
          hasActiveDateFilter={hasActiveDateFilter}
          hasMoreTagOptions={hasMoreTagOptions}
          hasMoreUserOptions={hasMoreUserOptions}
          initialTab={filterModalActiveTab}
          language={language}
          onApplyDateFilter={() => {
            void handleApplyDateFilter();
          }}
          onClearDateFilter={() => {
            void handleClearDateFilter();
          }}
          onClose={closeFilterModal}
          onDateFilterDraftFromChange={setDateFilterDraftFrom}
          onDateFilterDraftTargetChange={setDateFilterDraftTarget}
          onDateFilterDraftToChange={setDateFilterDraftTo}
          onLoadMoreTags={loadMoreTagOptions}
          onLoadMoreUsers={loadMoreUserOptions}
          onTagSearchQueryChange={setTagSearchQuery}
          onTagSortOptionChange={setTagSortOption}
          onToggleAuthorFilter={(screenName) => {
            void handleToggleAuthorFilter(screenName);
          }}
          onToggleTagFilter={(normalizedName) => {
            void handleToggleTagFilter(normalizedName);
          }}
          onUserSearchQueryChange={setUserSearchQuery}
          remainingTagOptionCount={remainingTagOptionCount}
          remainingUserOptionCount={remainingUserOptionCount}
          selectedAuthorFilter={selectedAuthorFilter}
          selectedTagFilter={selectedTagFilter}
          tagSearchQuery={tagSearchQuery}
          tagSortOption={tagSortOption}
          userSearchQuery={userSearchQuery}
          userSummaries={userSummaries}
          visibleTagOptionCount={visibleTagOptions.length}
        />
      )}

      {isBulkTagModalOpen && (
        <BulkTagModal
          filter={getCurrentPostFilterInput()}
          currentFilteredCount={archiveTotalCount}
          allTagSummaries={availableTags}
          language={language}
          onClose={closeBulkTagModal}
          onCompleted={refreshArchive}
        />
      )}

      {mediaLightbox.activeMedia !== null && (
        <ImageLightboxDialog
          activeMedia={mediaLightbox.activeMedia}
          language={language}
          closeButtonRef={mediaLightbox.imageLightboxCloseButtonRef}
          dialogRef={mediaLightbox.imageLightboxRef}
          onClose={mediaLightbox.closeImageLightbox}
          onMove={mediaLightbox.moveImageLightbox}
        />
      )}

      {mediaLightbox.activeVideo !== null && (
        <VideoLightboxDialog
          activeVideo={mediaLightbox.activeVideo}
          language={language}
          closeButtonRef={mediaLightbox.videoLightboxCloseButtonRef}
          dialogRef={mediaLightbox.videoLightboxRef}
          onClose={mediaLightbox.closeVideoLightbox}
        />
      )}
    </main>
  );
}

function isFontSizeOption(value: unknown): value is FontSizeOption {
  return value === "small" || value === "medium" || value === "large";
}

function formatCount(value: number, language: ArchiveLanguage = "en"): string {
  return new Intl.NumberFormat(language === "ja" ? "ja-JP" : "en-US").format(value);
}

function createRandomSeed(): number {
  const seed = new Uint32Array(1);
  globalThis.crypto.getRandomValues(seed);
  const nextSeed = seed[0];
  return nextSeed === undefined || nextSeed === 0 ? 1 : nextSeed;
}

function formatUserSummaryLabel(user: UserSummary): string {
  return `${user.display_name} (@${user.screen_name})`;
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

function buildDateFilterRequest(
  dateFilterTarget: DateFilterTarget | null,
  dateFrom: string | null,
  dateTo: string | null
): Pick<ListPostsPageInput, "dateFilterTarget" | "dateFrom" | "dateTo"> {
  const normalizedDateFrom = normalizeDateInputValue(dateFrom ?? "");
  const normalizedDateTo = normalizeDateInputValue(dateTo ?? "");
  const requestDateFrom = toDateFilterStartTimestamp(normalizedDateFrom);
  const requestDateTo = toDateFilterEndTimestamp(normalizedDateTo);
  const hasDateRange = requestDateFrom !== null || requestDateTo !== null;

  return {
    dateFilterTarget: hasDateRange ? dateFilterTarget ?? DEFAULT_DATE_FILTER_TARGET : null,
    dateFrom: requestDateFrom,
    dateTo: requestDateTo
  };
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
      : "Start date must be on or before the end date.";
  }

  return null;
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

function formatEmptyArchiveMessage(input: {
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

function formatArchiveCountLabel(
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

function findPostCardElement(xPostId: string): HTMLElement | null {
  const elements = document.querySelectorAll<HTMLElement>("[data-post-id]");

  for (const element of elements) {
    if (element.dataset.postId === xPostId) {
      return element;
    }
  }

  return null;
}

function findCurrentAnchorPostId(): string | null {
  const elements = document.querySelectorAll<HTMLElement>("[data-post-id]");
  let bestMatch: {
    xPostId: string;
    distance: number;
  } | null = null;

  for (const element of elements) {
    const xPostId = element.dataset.postId;

    if (xPostId === undefined) {
      continue;
    }

    const rect = element.getBoundingClientRect();

    if (rect.bottom <= 0) {
      continue;
    }

    const distance = Math.abs(rect.top);

    if (bestMatch === null || distance < bestMatch.distance) {
      bestMatch = {
        xPostId,
        distance
      };
    }
  }

  return bestMatch?.xPostId ?? null;
}

