import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import type {
  ArchivePostRecord,
  ArchiveSettings,
  ArchiveTagRecord,
  MediaRecord
} from "../../../types/archive";
import { defaultArchiveSettings } from "../../../types/archive";
import { DEFAULT_REFETCH_STATUS, type RefetchStatusRecord } from "../../../types/refetch";
import type {
  ArchiveSummaryRecord,
  ArchiveTagSummaryRecord,
  DateFilterTarget,
  FontSizeOption,
  ListPostsPageInput,
  PostSortField,
  StorageEstimateState,
  SortDirection,
  UserSummary,
  ViewerSessionRestoreMode
} from "../../../types/viewer";
import type { ViewerTheme } from "../../../types/viewer";
import { readBlobFromOpfs } from "../../media-storage/opfs-media-storage";
import {
  requestAddPostTagByName,
  requestArchiveSummary,
  requestDeletePost,
  requestPostsPage,
  requestRefetchCancel,
  requestRefetchClear,
  requestRefetchEnqueueAll,
  requestRefetchEnqueuePosts,
  requestRefetchStatus,
  requestRemovePostTagByName,
  requestTagSummaries,
  requestUserSummaries
} from "../../runtime/client";
import { createLogger } from "../../logging/logger";
import { SettingsArchiveMaintenancePanel } from "./settings-archive-maintenance-panel";
import { SettingsBasicPanel } from "./settings-basic-panel";
import { SettingsLogPanel } from "./settings-log-panel";
import { SettingsTagManagementPanel } from "./settings-tag-management-panel";
import { SettingsTagRedirectsPanel } from "./settings-tag-redirects-panel";
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
import { TagPickerOverlay } from "./tag-picker-overlay";
import { useIncrementalList } from "./use-incremental-list";
import { useDialogA11y } from "./use-dialog-a11y";

type ViewerStatus = "idle" | "loading" | "ready";
type ViewerScreen = "archive" | "settings";
type SettingsTab = "basic" | "tags" | "tag-rules" | "backup" | "log";
type TagSortOption = "count" | "name";
type ActiveMedia = {
  items: MediaRecord[];
  currentIndex: number;
};
type ActiveVideo = {
  media: MediaRecord;
  objectUrl: string | null;
  status: "loading" | "ready" | "error";
};
const VIEWER_FONT_SIZE_STORAGE_KEY = "viewer.fontSize";
const DEFAULT_PAGE_SIZE = 50;
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
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("basic");
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
  const [activeMedia, setActiveMedia] = useState<ActiveMedia | null>(null);
  const [activeVideo, setActiveVideo] = useState<ActiveVideo | null>(null);
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  const [activeAuthorFilter, setActiveAuthorFilter] = useState<string | null>(null);
  const [activeDateFilterTarget, setActiveDateFilterTarget] = useState<DateFilterTarget | null>(null);
  const [activeDateFrom, setActiveDateFrom] = useState<string | null>(null);
  const [activeDateTo, setActiveDateTo] = useState<string | null>(null);
  const [isTagFilterModalOpen, setIsTagFilterModalOpen] = useState(false);
  const [isAuthorFilterModalOpen, setIsAuthorFilterModalOpen] = useState(false);
  const [isDateFilterModalOpen, setIsDateFilterModalOpen] = useState(false);
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
  const [refetchStatus, setRefetchStatus] = useState<RefetchStatusRecord>(DEFAULT_REFETCH_STATUS);
  const [storageEstimate, setStorageEstimate] = useState<StorageEstimateState>({
    usage: null,
    quota: null,
    available: null,
    status: "idle"
  });
  const activeVideoUrlRef = useRef<string | null>(null);
  const shouldPersistSessionRef = useRef(false);
  const restoreScrollTopRef = useRef<number | null>(null);
  const previousRefetchStatusRef = useRef<RefetchStatusRecord>(DEFAULT_REFETCH_STATUS);
  const [restoreTargetPostId, setRestoreTargetPostId] = useState<string | null>(null);
  const archiveSectionRef = useRef<HTMLElement | null>(null);
  const settingsButtonRef = useRef<HTMLButtonElement | null>(null);
  const backToArchiveButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousScreenRef = useRef<ViewerScreen>("archive");
  const tagFilterDialogRef = useRef<HTMLElement | null>(null);
  const tagFilterSearchInputRef = useRef<HTMLInputElement | null>(null);
  const authorFilterDialogRef = useRef<HTMLElement | null>(null);
  const authorFilterSearchInputRef = useRef<HTMLInputElement | null>(null);
  const dateFilterDialogRef = useRef<HTMLElement | null>(null);
  const dateFilterTargetInputRef = useRef<HTMLSelectElement | null>(null);
  const imageLightboxRef = useRef<HTMLDivElement | null>(null);
  const imageLightboxCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const videoLightboxRef = useRef<HTMLDivElement | null>(null);
  const videoLightboxCloseButtonRef = useRef<HTMLButtonElement | null>(null);

  const viewerScale = FONT_SIZE_SCALE[fontSize];
  const settingsTabOptions = getSettingsTabOptions(language);
  const activeSettingsTabPanelId = getSettingsTabPanelId(settingsTab);
  const activeSettingsTabButtonId = getSettingsTabButtonId(settingsTab);

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

  function closeTagFilterModal() {
    setIsTagFilterModalOpen(false);
  }

  function closeAuthorFilterModal() {
    setIsAuthorFilterModalOpen(false);
  }

  function openDateFilterModal() {
    setDateFilterDraftTarget(activeDateFilterTarget ?? DEFAULT_DATE_FILTER_TARGET);
    setDateFilterDraftFrom(activeDateFrom ?? "");
    setDateFilterDraftTo(activeDateTo ?? "");
    setIsDateFilterModalOpen(true);
  }

  function closeDateFilterModal() {
    setIsDateFilterModalOpen(false);
  }

  function closeImageLightbox() {
    setActiveMedia(null);
  }

  function closeVideoLightbox() {
    setActiveVideo(null);
  }

  useDialogA11y({
    isOpen: isTagFilterModalOpen,
    containerRef: tagFilterDialogRef,
    initialFocusRef: tagFilterSearchInputRef,
    onClose: closeTagFilterModal
  });
  useDialogA11y({
    isOpen: isAuthorFilterModalOpen,
    containerRef: authorFilterDialogRef,
    initialFocusRef: authorFilterSearchInputRef,
    onClose: closeAuthorFilterModal
  });
  useDialogA11y({
    isOpen: isDateFilterModalOpen,
    containerRef: dateFilterDialogRef,
    initialFocusRef: dateFilterTargetInputRef,
    onClose: closeDateFilterModal
  });
  useDialogA11y({
    isOpen: activeMedia !== null,
    containerRef: imageLightboxRef,
    initialFocusRef: imageLightboxCloseButtonRef,
    onClose: closeImageLightbox
  });
  useDialogA11y({
    isOpen: activeVideo !== null,
    containerRef: videoLightboxRef,
    initialFocusRef: videoLightboxCloseButtonRef,
    onClose: closeVideoLightbox
  });

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
            initialLimit = Math.max(DEFAULT_PAGE_SIZE, savedSession.loadedCount);
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
    if (activeVideo === null) {
      return undefined;
    }

    const currentVideo = activeVideo;
    let cancelled = false;

    async function loadVideo() {
      try {
        const blob = await readBlobFromOpfs(currentVideo.media.opfs_path);
        const createdUrl = URL.createObjectURL(blob);
        activeVideoUrlRef.current = createdUrl;

        if (!cancelled) {
          setActiveVideo({
            media: currentVideo.media,
            objectUrl: createdUrl,
            status: "ready"
          });
        }
      } catch (error) {
        logger.error("video.load.failed", {
          message: "Failed to load video from OPFS.",
          context: {
            mediaId: currentVideo.media.media_id,
            error
          }
        });

        if (!cancelled) {
          setActiveVideo({
            media: currentVideo.media,
            objectUrl: null,
            status: "error"
          });
        }
      }
    }

    if (currentVideo.status === "loading" && currentVideo.objectUrl === null) {
      if (activeVideoUrlRef.current !== null) {
        URL.revokeObjectURL(activeVideoUrlRef.current);
        activeVideoUrlRef.current = null;
      }

      void loadVideo();
    }

    return () => {
      cancelled = true;
    };
  }, [activeVideo]);

  useEffect(() => {
    if (activeVideo !== null) {
      return;
    }

    if (activeVideoUrlRef.current !== null) {
      URL.revokeObjectURL(activeVideoUrlRef.current);
      activeVideoUrlRef.current = null;
    }
  }, [activeVideo]);

  useEffect(() => {
    if (activeMedia === null) {
      return undefined;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowLeft") {
        setActiveMedia((current) => moveActiveMedia(current, -1));
        return;
      }

      if (event.key === "ArrowRight") {
        setActiveMedia((current) => moveActiveMedia(current, 1));
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeMedia]);

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

      if (input.append) {
        setPosts((current) => [...current, ...response.posts]);
      } else {
        setPosts(response.posts);
      }

      setArchiveTotalCount(response.totalCount);
      setHasMorePosts(response.hasMore);
      setStatus("ready");
    } catch (error) {
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

  useEffect(() => {
    let cancelled = false;
    let timeoutId: number | null = null;

    async function pollRefetchStatus() {
      try {
        const response = await requestRefetchStatus();

        if (cancelled) {
          return;
        }

        const previousStatus = previousRefetchStatusRef.current;
        const nextStatus = response.status;

        previousRefetchStatusRef.current = nextStatus;
        setRefetchStatus(nextStatus);

        if (
          previousStatus.phase === "running" &&
          nextStatus.phase !== "running" &&
          (nextStatus.completedCount > 0 || nextStatus.failedCount > 0)
        ) {
          void refreshArchive();
        }
      } catch (error) {
        logger.warn("refetch.status.poll_failed", {
          message: "Failed to poll refetch status.",
          context: {
            error
          }
        });
      } finally {
        if (cancelled) {
          return;
        }

        const intervalMs =
          refetchStatus.phase === "running" || refetchStatus.totalCount > 0 ? 1000 : 5000;
        timeoutId = window.setTimeout(() => {
          void pollRefetchStatus();
        }, intervalMs);
      }
    }

    void pollRefetchStatus();

    return () => {
      cancelled = true;

      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [refetchStatus.phase, refetchStatus.totalCount]);

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

  async function handleRefetchPost(xPostId: string): Promise<void> {
    try {
      const response = await requestRefetchEnqueuePosts([xPostId], 1);
      previousRefetchStatusRef.current = response.status;
      setRefetchStatus(response.status);
    } catch (error) {
      logger.error("refetch.post.enqueue_failed", {
        message: "Failed to enqueue a post refetch.",
        context: {
          xPostId,
          error
        }
      });
      setLoadNotice(
        language === "ja"
          ? "投稿の再取得を開始できませんでした。"
          : "The post could not be queued for refetch."
      );
    }
  }

  async function handleRefetchAllPosts(): Promise<void> {
    try {
      const response = await requestRefetchEnqueueAll(0);
      previousRefetchStatusRef.current = response.status;
      setRefetchStatus(response.status);
    } catch (error) {
      logger.error("refetch.bulk.enqueue_failed", {
        message: "Failed to enqueue archive refetch.",
        context: {
          error
        }
      });
    }
  }

  async function handleCancelRefetch(): Promise<void> {
    try {
      const response = await requestRefetchCancel();
      previousRefetchStatusRef.current = response.status;
      setRefetchStatus(response.status);
    } catch (error) {
      logger.error("refetch.cancel.failed", {
        message: "Failed to stop refetch processing.",
        context: {
          error
        }
      });
    }
  }

  async function handleClearRefetchQueue(): Promise<void> {
    try {
      const response = await requestRefetchClear();
      previousRefetchStatusRef.current = response.status;
      setRefetchStatus(response.status);
    } catch (error) {
      logger.error("refetch.clear.failed", {
        message: "Failed to clear the refetch queue.",
        context: {
          error
        }
      });
    }
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
    closeTagFilterModal();
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
    closeAuthorFilterModal();
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
    closeDateFilterModal();
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
    closeDateFilterModal();
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

  function handleSettingsTabKeyDown(
    currentIndex: number,
    event: ReactKeyboardEvent<HTMLButtonElement>
  ) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft" && event.key !== "Home" && event.key !== "End") {
      return;
    }

    event.preventDefault();

    if (event.key === "Home") {
      setSettingsTab(settingsTabOptions[0]?.tab ?? "basic");
      return;
    }

    if (event.key === "End") {
      setSettingsTab(settingsTabOptions[settingsTabOptions.length - 1]?.tab ?? "log");
      return;
    }

    const direction = event.key === "ArrowRight" ? 1 : -1;
    const nextIndex =
      (currentIndex + direction + settingsTabOptions.length) % settingsTabOptions.length;

    setSettingsTab(settingsTabOptions[nextIndex]?.tab ?? settingsTab);
  }

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
          <section className="viewer-hero">
            <div className="viewer-eyebrow-row">
              <button
                ref={settingsButtonRef}
                className="viewer-icon-button"
                type="button"
                aria-label={language === "ja" ? "設定を開く" : "Open settings"}
                onClick={() => {
                  setSettingsTab("basic");
                  setScreen("settings");
                }}
              >
                <GearIcon />
              </button>
            </div>
          </section>

          <section className="viewer-list-panel" ref={archiveSectionRef}>
            <div className="viewer-list-header">
              <div className="viewer-list-heading">
                <h2>{language === "ja" ? "一覧" : "Archive"}</h2>
                <span>
                  {formatArchiveCountLabel(posts.length, archiveTotalCount, hasMorePosts, language)}
                </span>
              </div>
              <div
                className="viewer-sort-controls"
                aria-label={language === "ja" ? "投稿の並び替え" : "Sort posts"}
              >
                {userSummaries.length > 0 && (
                  <button
                    className="viewer-secondary-button"
                    type="button"
                    onClick={() => {
                      setIsAuthorFilterModalOpen(true);
                    }}
                  >
                    {language === "ja" ? "ユーザー絞り込み" : "User filter"}
                  </button>
                )}
                {availableTags.length > 0 && (
                  <button
                    className="viewer-secondary-button"
                    type="button"
                    onClick={() => {
                      setIsTagFilterModalOpen(true);
                    }}
                  >
                    {language === "ja" ? "タグ絞り込み" : "Tag filter"}
                  </button>
                )}
                <button
                  className="viewer-secondary-button"
                  type="button"
                  onClick={() => {
                    openDateFilterModal();
                  }}
                >
                  {language === "ja" ? "日付絞り込み" : "Date filter"}
                </button>
                <label className="viewer-sort-label">
                  <span>{language === "ja" ? "並び順" : "Sort"}</span>
                  <select
                    className="viewer-sort-select"
                    value={sortField}
                    onChange={(event) => {
                      void handleSortFieldChange(event.currentTarget.value as PostSortField);
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
                  <button
                    className="viewer-secondary-button"
                    type="button"
                    onClick={() => {
                      void handleReshuffle();
                    }}
                  >
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
                    onClick={() => {
                      void handleSortDirectionToggle();
                    }}
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
              </div>
            </div>

            {activeAuthorFilter !== null && (
              <div className="viewer-active-tag-filter">
                <div className="viewer-active-tag-copy">
                  <strong>{language === "ja" ? "ユーザーで絞り込み中" : "Filtered by user"}</strong>
                  <span>
                    {formatAuthorFilterLabel(
                      selectedAuthorFilter,
                      activeAuthorFilter,
                      archiveTotalCount,
                      language
                    )}
                  </span>
                </div>
                <div className="viewer-active-tag-actions">
                  <button
                    className="viewer-tag-filter-clear"
                    type="button"
                    onClick={() => {
                      void handleToggleAuthorFilter(activeAuthorFilter);
                    }}
                  >
                    {language === "ja" ? "解除" : "Clear"}
                  </button>
                </div>
              </div>
            )}

            {selectedTagFilter !== null && (
              <div className="viewer-active-tag-filter">
                <div className="viewer-active-tag-copy">
                  <strong>{language === "ja" ? "タグで絞り込み中" : "Filtered by tag"}</strong>
                  <span>
                    {formatTagFilterLabel(
                      getTagDisplayName(selectedTagFilter.tag),
                      selectedTagFilter.postCount,
                      language
                    )}
                  </span>
                </div>
                <div className="viewer-active-tag-actions">
                  <button
                    className="viewer-tag-filter-clear"
                    type="button"
                    onClick={() => {
                      void handleToggleTagFilter(selectedTagFilter.tag.normalized_name);
                    }}
                  >
                    {language === "ja" ? "解除" : "Clear"}
                  </button>
                </div>
              </div>
            )}

            {hasActiveDateFilter && (
              <div className="viewer-active-tag-filter">
                <div className="viewer-active-tag-copy">
                  <strong>{language === "ja" ? "日付で絞り込み中" : "Filtered by date"}</strong>
                  <span>
                    {formatActiveDateFilterLabel(
                      activeDateFilterTarget ?? DEFAULT_DATE_FILTER_TARGET,
                      activeDateFrom,
                      activeDateTo,
                      archiveTotalCount,
                      language
                    )}
                  </span>
                </div>
                <div className="viewer-active-tag-actions">
                  <button
                    className="viewer-tag-filter-clear"
                    type="button"
                    onClick={() => {
                      void handleClearDateFilter();
                    }}
                  >
                    {language === "ja" ? "解除" : "Clear"}
                  </button>
                </div>
              </div>
            )}

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
                  <article className="post-card" data-post-id={post.x_post_id} key={post.x_post_id}>
                    <div className="post-card-header">
                      <div>
                        <p className="post-username">
                          <span>{post.display_name}</span>
                          <span className="post-handle">@{post.x_username}</span>
                        </p>
                        <div className="post-date-list">
                          <p className="post-date">
                            <span className="post-date-label">
                              {language === "ja" ? "投稿日時" : "Posted"}
                            </span>
                            <span>{formatPostedAt(post.posted_at, language)}</span>
                          </p>
                          <p className="post-date">
                            <span className="post-date-label">
                              {language === "ja" ? "保存日時" : "Saved"}
                            </span>
                            <span>{formatSavedAt(post.saved_at, language)}</span>
                          </p>
                        </div>
                      </div>
                      <div className="post-card-actions">
                        <button
                          className="post-refetch-button"
                          type="button"
                          aria-label={
                            language === "ja"
                              ? `@${post.x_username} の投稿を再取得`
                              : `Refetch post by @${post.x_username}`
                          }
                          onClick={() => {
                            void handleRefetchPost(post.x_post_id);
                          }}
                          disabled={refetchStatus.currentPostId === post.x_post_id}
                        >
                          {refetchStatus.currentPostId === post.x_post_id
                            ? language === "ja"
                              ? "再取得中..."
                              : "Refetching..."
                            : language === "ja"
                              ? "再取得"
                              : "Refetch"}
                        </button>
                        <button
                          className="post-delete-button"
                          type="button"
                          aria-label={
                            language === "ja"
                              ? `@${post.x_username} の投稿を削除`
                              : `Delete post by @${post.x_username}`
                          }
                          onClick={() => {
                            void handleDelete(post.x_post_id);
                          }}
                          disabled={deletingId === post.x_post_id}
                        >
                          {deletingId === post.x_post_id
                            ? language === "ja"
                              ? "削除中..."
                              : "Deleting..."
                            : language === "ja"
                              ? "削除"
                              : "Delete"}
                        </button>
                      </div>
                    </div>

                    {post.post_text.trim() !== "" && <p className="post-text">{post.post_text}</p>}

                    {post.quoted_post !== undefined && (
                      <QuotedPostCard
                        post={post.quoted_post}
                        language={language}
                        onOpenMedia={(quotedPost, media) => {
                          const items = quotedPost.media.filter(
                            (postMedia) =>
                              postMedia.media_type === "image" &&
                              postMedia.storage_status === "ready"
                          );
                          const currentIndex = items.findIndex(
                            (item) => item.media_id === media.media_id
                          );

                          if (items.length === 0 || currentIndex < 0) {
                            return;
                          }

                          setActiveMedia({
                            items,
                            currentIndex
                          });
                        }}
                        onOpenVideo={(media) => {
                          setActiveVideo({
                            media,
                            objectUrl: null,
                            status: "loading"
                          });
                        }}
                      />
                    )}

                    {post.media.length > 0 && (
                      <div className="post-media-grid">
                        {post.media.map((media) => (
                          <MediaCard
                            key={media.media_id}
                            language={language}
                            media={media}
                            onOpen={() => {
                              if (media.media_type === "video") {
                                return;
                              }

                              const items = post.media.filter(
                                (postMedia) =>
                                  postMedia.media_type === "image" &&
                                  postMedia.storage_status === "ready"
                              );
                              const currentIndex = items.findIndex(
                                (item) => item.media_id === media.media_id
                              );

                              if (items.length === 0 || currentIndex < 0) {
                                return;
                              }

                              setActiveMedia({
                                items,
                                currentIndex
                              });
                            }}
                            onOpenVideo={() => {
                              setActiveVideo({
                                media,
                                objectUrl: null,
                                status: "loading"
                              });
                            }}
                          />
                        ))}
                      </div>
                    )}

                    <dl
                      className="post-metrics"
                      aria-label={language === "ja" ? "投稿の反応数" : "Post engagement"}
                    >
                      <div className="post-metric">
                        <dt>{language === "ja" ? "返信" : "Replies"}</dt>
                        <dd>{formatCount(post.reply_count, language)}</dd>
                      </div>
                      <div className="post-metric">
                        <dt>{language === "ja" ? "リポスト" : "Reposts"}</dt>
                        <dd>{formatCount(post.repost_count, language)}</dd>
                      </div>
                      <div className="post-metric">
                        <dt>{language === "ja" ? "いいね" : "Likes"}</dt>
                        <dd>{formatCount(post.like_count, language)}</dd>
                      </div>
                    </dl>

                    <div className="post-tag-section">
                      <div className="post-tag-toolbar">
                        {post.tags.length > 0 && (
                          <div className="tag-list">
                            {post.tags.map((tag) => (
                              <span
                                className={
                                  tag.source === "manual"
                                    ? "tag-chip tag-chip-manual"
                                    : "tag-chip"
                                }
                                key={`${post.x_post_id}-${tag.tag_id}`}
                              >
                                <button
                                  className="tag-chip-button"
                                  type="button"
                                  onClick={() => {
                                  void handleToggleTagFilter(tag.normalized_name);
                                }}
                              >
                                {getTagDisplayName(tag)}
                              </button>
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="post-tag-picker-anchor">
                          <button
                            className="post-tag-picker-button"
                            type="button"
                            aria-label={
                              language === "ja"
                                ? `@${post.x_username} の投稿タグを編集`
                                : `Edit tags for post by @${post.x_username}`
                            }
                            aria-haspopup="dialog"
                            aria-expanded={tagPickerPostId === post.x_post_id}
                            data-tag-picker-trigger-post-id={post.x_post_id}
                            onClick={() => {
                              setTagPickerPostId((current) =>
                                current === post.x_post_id ? null : post.x_post_id
                              );
                            }}
                            disabled={tagActionPostId === post.x_post_id}
                          >
                            +
                          </button>
                          {tagPickerPostId === post.x_post_id && (
                            <TagPickerOverlay
                              currentPostTags={post.tags}
                              allTagSummaries={availableTags}
                              onAdd={async (displayName) => {
                                await handleAddTagToPost(post.x_post_id, displayName);
                              }}
                              onRemove={async (normalizedName) => {
                                await handleRemoveTagFromPost(post.x_post_id, normalizedName);
                              }}
                              onClose={() => {
                                setTagPickerPostId(null);
                              }}
                              language={language}
                              isPending={tagActionPostId === post.x_post_id}
                            />
                          )}
                        </div>
                      </div>
                    </div>

                    <a
                      className="post-link"
                      href={post.post_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {post.post_url}
                    </a>
                  </article>
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
        <>
          <section className="viewer-hero viewer-settings-hero">
            <div className="viewer-hero-header">
              <button
                ref={backToArchiveButtonRef}
                className="viewer-icon-button"
                type="button"
                aria-label={language === "ja" ? "一覧へ戻る" : "Back to archive"}
                onClick={() => {
                  setScreen("archive");
                }}
              >
                <ArrowLeftIcon />
              </button>
            </div>
          </section>

          <section className="viewer-list-panel viewer-settings-panel">
            <div className="viewer-list-header">
              <h2>{language === "ja" ? "設定" : "Options"}</h2>
            </div>
            <nav
              className="viewer-settings-tabs"
              aria-label={language === "ja" ? "設定ページ" : "Settings pages"}
              role="tablist"
            >
              {settingsTabOptions.map(({ tab, label }, index) => (
                <button
                  key={tab}
                  id={getSettingsTabButtonId(tab)}
                  type="button"
                  className={settingsTab === tab ? "viewer-settings-tab viewer-settings-tab-active" : "viewer-settings-tab"}
                  role="tab"
                  aria-selected={settingsTab === tab}
                  aria-controls={settingsTab === tab ? getSettingsTabPanelId(tab) : undefined}
                  tabIndex={settingsTab === tab ? 0 : -1}
                  onClick={() => {
                    setSettingsTab(tab);
                  }}
                  onKeyDown={(event) => {
                    handleSettingsTabKeyDown(index, event);
                  }}
                >
                  {label}
                </button>
              ))}
            </nav>
            <div
              className="viewer-settings-grid"
              id={activeSettingsTabPanelId}
              role="tabpanel"
              aria-labelledby={activeSettingsTabButtonId}
            >
              {settingsTab === "basic" && (
                <SettingsBasicPanel
                  language={language}
                  archiveSettings={archiveSettings}
                  currentTheme={viewerTheme}
                  fontSize={fontSize}
                  sessionRestoreMode={sessionRestoreMode}
                  storageEstimate={storageEstimate}
                  archiveSummary={archiveSummary}
                  onArchiveSettingsChange={handleArchiveSettingsChange}
                  onThemeChange={handleThemeChange}
                  onLanguageChange={handleLanguageChange}
                  onFontSizeChange={handleFontSizeChange}
                  onSessionRestoreModeChange={handleSessionRestoreModeChange}
                  onClearSavedSession={handleClearSavedSession}
                />
              )}

              {settingsTab === "tags" && (
                <SettingsTagManagementPanel
                  language={language}
                  onTagRenamed={handleTagRenamed}
                  onTagMerged={handleTagMerged}
                />
              )}

              {settingsTab === "tag-rules" && <SettingsTagRedirectsPanel language={language} />}

              {settingsTab === "backup" && (
                <SettingsArchiveMaintenancePanel
                  language={language}
                  archiveSummary={{
                    postCount: archiveSummary.postCount,
                    mediaCount: archiveSummary.mediaCount,
                    tagCount: archiveSummary.tagCount
                  }}
                  refetchStatus={refetchStatus}
                  onRefetchAll={handleRefetchAllPosts}
                  onRefetchCancel={handleCancelRefetch}
                  onRefetchClear={handleClearRefetchQueue}
                  onArchiveChanged={refreshArchive}
                />
              )}

              {settingsTab === "log" && <SettingsLogPanel language={language} />}
            </div>
          </section>
        </>
      )}

      {isTagFilterModalOpen && (
        <div
          className="viewer-modal-backdrop"
          role="presentation"
          onClick={() => {
            closeTagFilterModal();
          }}
        >
          <section
            ref={tagFilterDialogRef}
            className="viewer-modal viewer-tag-modal"
            role="dialog"
            aria-modal="true"
            aria-label={language === "ja" ? "タグ絞り込み" : "Tag filter"}
            tabIndex={-1}
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <div className="viewer-modal-header">
              <div className="viewer-modal-copy">
                <h2>{language === "ja" ? "タグで絞り込む" : "Filter by tag"}</h2>
                <p>
                  {language === "ja"
                    ? "タグをリアルタイム検索し、1つ選んで一覧を絞り込みます。"
                    : "Search tags in real time and choose one tag to narrow the archive list."}
                </p>
              </div>
              <button
                className="viewer-secondary-button"
                type="button"
                onClick={() => {
                  closeTagFilterModal();
                }}
              >
                {language === "ja" ? "閉じる" : "Close"}
              </button>
            </div>

            <div className="viewer-tag-modal-controls">
              <label className="viewer-sort-label">
                <span>{language === "ja" ? "検索" : "Search"}</span>
                <input
                  ref={tagFilterSearchInputRef}
                  className="tag-input"
                  type="search"
                  value={tagSearchQuery}
                  aria-label={language === "ja" ? "タグを検索" : "Search tags"}
                  placeholder={language === "ja" ? "タグを検索" : "Search tags"}
                  onChange={(event) => {
                    setTagSearchQuery(event.currentTarget.value);
                  }}
                />
              </label>
              <label className="viewer-sort-label">
                <span>{language === "ja" ? "並び順" : "Order"}</span>
                <select
                  className="viewer-sort-select"
                  value={tagSortOption}
                  onChange={(event) => {
                    setTagSortOption(event.currentTarget.value as TagSortOption);
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
                    void handleToggleTagFilter(selectedTagFilter.tag.normalized_name);
                  }}
                >
                  {language === "ja" ? "解除" : "Clear"}
                </button>
              </div>
            )}

            {visibleTagOptions.length === 0 ? (
              <p className="viewer-message">
                {language === "ja"
                  ? "現在の検索条件に一致するタグはありません。"
                  : "No tags match the current search."}
              </p>
            ) : (
              <>
                <div className="viewer-tag-option-list">
                  {displayedTagOptions.map(({ tag, postCount }) => (
                    <button
                      key={tag.tag_id}
                      className={
                        tag.normalized_name === activeTagFilter
                          ? "viewer-tag-option viewer-tag-option-active"
                          : "viewer-tag-option"
                      }
                      type="button"
                      onClick={() => {
                        void handleToggleTagFilter(tag.normalized_name);
                      }}
                    >
                      <strong>{getTagDisplayName(tag)}</strong>
                      <span>
                        {formatCount(postCount, language)} {language === "ja" ? "件" : "posts"}
                      </span>
                    </button>
                  ))}
                </div>
                {hasMoreTagOptions && (
                  <div className="viewer-incremental-list-footer">
                    <p className="viewer-incremental-list-meta">
                      {language === "ja"
                        ? `残り ${formatCount(remainingTagOptionCount, language)} 件のタグがあります。`
                        : `${formatCount(remainingTagOptionCount, language)} more tags available.`}
                    </p>
                    <button
                      className="viewer-secondary-button"
                      type="button"
                      onClick={() => {
                        loadMoreTagOptions();
                      }}
                    >
                      {language === "ja" ? "さらに表示" : "Load more"}
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      )}

      {isAuthorFilterModalOpen && (
        <div
          className="viewer-modal-backdrop"
          role="presentation"
          onClick={() => {
            closeAuthorFilterModal();
          }}
        >
          <section
            ref={authorFilterDialogRef}
            className="viewer-modal viewer-tag-modal"
            role="dialog"
            aria-modal="true"
            aria-label={language === "ja" ? "ユーザー絞り込み" : "User filter"}
            tabIndex={-1}
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <div className="viewer-modal-header">
              <div className="viewer-modal-copy">
                <h2>{language === "ja" ? "ユーザーで絞り込む" : "Filter by user"}</h2>
                <p>
                  {language === "ja"
                    ? "投稿者名や @screen_name で検索し、1人選んで一覧を絞り込みます。"
                    : "Search authors by name or @screen_name and choose one to narrow the archive list."}
                </p>
              </div>
              <button
                className="viewer-secondary-button"
                type="button"
                onClick={() => {
                  closeAuthorFilterModal();
                }}
              >
                {language === "ja" ? "閉じる" : "Close"}
              </button>
            </div>

            <div className="viewer-user-modal-controls">
              <label className="viewer-sort-label">
                <span>{language === "ja" ? "検索" : "Search"}</span>
                <input
                  ref={authorFilterSearchInputRef}
                  className="tag-input"
                  type="search"
                  value={userSearchQuery}
                  aria-label={language === "ja" ? "ユーザーを検索" : "Search users"}
                  placeholder={language === "ja" ? "ユーザーを検索" : "Search users"}
                  onChange={(event) => {
                    setUserSearchQuery(event.currentTarget.value);
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
                    void handleToggleAuthorFilter(activeAuthorFilter);
                  }}
                >
                  {language === "ja" ? "解除" : "Clear"}
                </button>
              </div>
            )}

            {visibleUserOptions.length === 0 ? (
              <p className="viewer-message">
                {language === "ja"
                  ? "現在の検索条件に一致するユーザーはありません。"
                  : "No users match the current search."}
              </p>
            ) : (
              <>
                <div className="viewer-tag-option-list">
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
                        void handleToggleAuthorFilter(user.screen_name);
                      }}
                    >
                      <strong>{formatUserSummaryLabel(user)}</strong>
                      <span>
                        {formatCount(user.post_count, language)}{" "}
                        {language === "ja" ? "件" : "posts"}
                      </span>
                    </button>
                  ))}
                </div>
                {hasMoreUserOptions && (
                  <div className="viewer-incremental-list-footer">
                    <p className="viewer-incremental-list-meta">
                      {language === "ja"
                        ? `残り ${formatCount(remainingUserOptionCount, language)} 人のユーザーがいます。`
                        : `${formatCount(remainingUserOptionCount, language)} more users available.`}
                    </p>
                    <button
                      className="viewer-secondary-button"
                      type="button"
                      onClick={() => {
                        loadMoreUserOptions();
                      }}
                    >
                      {language === "ja" ? "さらに表示" : "Load more"}
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      )}

      {isDateFilterModalOpen && (
        <div
          className="viewer-modal-backdrop"
          role="presentation"
          onClick={() => {
            closeDateFilterModal();
          }}
        >
          <section
            ref={dateFilterDialogRef}
            className="viewer-modal"
            role="dialog"
            aria-modal="true"
            aria-label={language === "ja" ? "日付絞り込み" : "Date filter"}
            tabIndex={-1}
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <div className="viewer-modal-header">
              <div className="viewer-modal-copy">
                <h2>{language === "ja" ? "日付で絞り込む" : "Filter by date"}</h2>
                <p>
                  {language === "ja"
                    ? "保存日時または投稿日時で期間を指定し、一覧を絞り込みます。"
                    : "Choose a saved-at or posted-at range to narrow the archive list."}
                </p>
              </div>
              <button
                className="viewer-secondary-button"
                type="button"
                onClick={() => {
                  closeDateFilterModal();
                }}
              >
                {language === "ja" ? "閉じる" : "Close"}
              </button>
            </div>

            <div className="viewer-date-modal-controls">
              <label className="viewer-sort-label">
                <span>{language === "ja" ? "対象" : "Target"}</span>
                <select
                  ref={dateFilterTargetInputRef}
                  className="viewer-sort-select"
                  value={dateFilterDraftTarget}
                  onChange={(event) => {
                    setDateFilterDraftTarget(event.currentTarget.value as DateFilterTarget);
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
                    setDateFilterDraftFrom(event.currentTarget.value);
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
                    setDateFilterDraftTo(event.currentTarget.value);
                  }}
                />
              </label>
            </div>

            {hasActiveDateFilter && (
              <div className="viewer-tag-modal-summary">
                <span>
                  {language === "ja" ? "適用中" : "Active"}:{" "}
                  {formatActiveDateFilterLabel(
                    activeDateFilterTarget ?? DEFAULT_DATE_FILTER_TARGET,
                    activeDateFrom,
                    activeDateTo,
                    archiveTotalCount,
                    language
                  )}
                </span>
                <button
                  className="viewer-tag-filter-clear"
                  type="button"
                  onClick={() => {
                    void handleClearDateFilter();
                  }}
                >
                  {language === "ja" ? "解除" : "Clear"}
                </button>
              </div>
            )}

            {dateFilterDraftError !== null && (
              <p className="viewer-modal-inline-error">{dateFilterDraftError}</p>
            )}

            <div className="viewer-modal-actions">
              <button
                className="viewer-secondary-button"
                type="button"
                onClick={() => {
                  void handleClearDateFilter();
                }}
              >
                {language === "ja" ? "クリア" : "Clear"}
              </button>
              <button
                className="viewer-action-button"
                type="button"
                onClick={() => {
                  void handleApplyDateFilter();
                }}
                disabled={dateFilterDraftError !== null}
              >
                {language === "ja" ? "適用" : "Apply"}
              </button>
            </div>
          </section>
        </div>
      )}

      {activeMedia !== null && (
        <div
          ref={imageLightboxRef}
          className="media-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={language === "ja" ? "画像ビューア" : "Image viewer"}
          tabIndex={-1}
          onClick={() => {
            closeImageLightbox();
          }}
        >
          {activeMedia.items.length > 1 && (
            <button
              className="media-lightbox-nav media-lightbox-nav-prev"
              type="button"
              aria-label={language === "ja" ? "前の画像を表示" : "Show previous image"}
              disabled={activeMedia.currentIndex === 0}
              onClick={(event) => {
                event.stopPropagation();
                setActiveMedia((current) => moveActiveMedia(current, -1));
              }}
            >
              {language === "ja" ? "前へ" : "Previous"}
            </button>
          )}
          {activeMedia.items.length > 1 && (
            <button
              className="media-lightbox-nav media-lightbox-nav-next"
              type="button"
              aria-label={language === "ja" ? "次の画像を表示" : "Show next image"}
              disabled={activeMedia.currentIndex === activeMedia.items.length - 1}
              onClick={(event) => {
                event.stopPropagation();
                setActiveMedia((current) => moveActiveMedia(current, 1));
              }}
            >
              {language === "ja" ? "次へ" : "Next"}
            </button>
          )}
          <button
            ref={imageLightboxCloseButtonRef}
            className="media-lightbox-close"
            type="button"
            aria-label={language === "ja" ? "画像ビューアを閉じる" : "Close image viewer"}
            onClick={() => {
              closeImageLightbox();
            }}
          >
            {language === "ja" ? "閉じる" : "Close"}
          </button>
          <figure
            className="media-lightbox-panel"
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <LightboxImage
              media={activeMedia.items[activeMedia.currentIndex] ?? null}
              language={language}
            />
            {activeMedia.items[activeMedia.currentIndex]?.alt_text !== null && (
              <figcaption className="media-lightbox-alt">
                {activeMedia.items[activeMedia.currentIndex]?.alt_text}
              </figcaption>
            )}
          </figure>
        </div>
      )}

      {activeVideo !== null && (
        <div
          ref={videoLightboxRef}
          className="media-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={language === "ja" ? "動画ビューア" : "Video viewer"}
          tabIndex={-1}
          onClick={() => {
            closeVideoLightbox();
          }}
        >
          <button
            ref={videoLightboxCloseButtonRef}
            className="media-lightbox-close"
            type="button"
            aria-label={language === "ja" ? "動画ビューアを閉じる" : "Close video viewer"}
            onClick={() => {
              closeVideoLightbox();
            }}
          >
            {language === "ja" ? "閉じる" : "Close"}
          </button>
          <figure
            className="media-lightbox-panel"
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            {activeVideo.status === "loading" && (
              <div className="post-media-status">
                {language === "ja" ? "動画を読み込み中..." : "Loading video..."}
              </div>
            )}
            {activeVideo.status === "error" && (
              <div className="post-media-status post-media-status-error">
                <strong>
                  {language === "ja" ? "動画の読み込みに失敗しました。" : "Video load failed."}
                </strong>
                <span>
                  {activeVideo.media.last_error ??
                    (language === "ja" ? "不明なメディアエラーです。" : "Unknown media error.")}
                </span>
              </div>
            )}
            {activeVideo.status === "ready" && activeVideo.objectUrl !== null && (
              <video
                className="media-lightbox-video"
                src={activeVideo.objectUrl}
                controls
                autoPlay
                preload="metadata"
                playsInline
              />
            )}
          </figure>
        </div>
      )}
    </main>
  );
}

function QuotedPostCard({
  post,
  language,
  onOpenMedia,
  onOpenVideo
}: {
  post: ArchivePostRecord;
  language: ArchiveLanguage;
  onOpenMedia: (post: ArchivePostRecord, media: MediaRecord) => void;
  onOpenVideo: (media: MediaRecord) => void;
}) {
  return (
    <section
      className="quoted-post-card"
      aria-label={language === "ja" ? "引用投稿" : "Quoted post"}
    >
      <div className="quoted-post-header">
        <p className="quoted-post-username">
          <span>{post.display_name}</span>
          <span className="post-handle">@{post.x_username}</span>
        </p>
        <span className="quoted-post-date">{formatPostedAt(post.posted_at, language)}</span>
      </div>

      {post.post_text.trim() !== "" && <p className="quoted-post-text">{post.post_text}</p>}

      {post.media.length > 0 && (
        <div className="quoted-post-media-grid">
          {post.media.map((media) => (
            <MediaCard
              key={media.media_id}
              language={language}
              media={media}
              onOpen={() => {
                if (media.media_type === "video") {
                  return;
                }

                onOpenMedia(post, media);
              }}
              onOpenVideo={() => {
                onOpenVideo(media);
              }}
            />
          ))}
        </div>
      )}

      <a className="quoted-post-link" href={post.post_url} target="_blank" rel="noreferrer">
        {language === "ja" ? "引用元を開く" : "Open quoted post"}
      </a>
    </section>
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

function ArrowLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M14.7 5.3a1 1 0 0 1 0 1.4L10.41 11H20a1 1 0 1 1 0 2h-9.59l4.29 4.3a1 1 0 0 1-1.41 1.4l-6-6a1 1 0 0 1 0-1.4l6-6a1 1 0 0 1 1.41 0Z"
        fill="currentColor"
      />
    </svg>
  );
}

function MediaCard({
  language,
  media,
  onOpen,
  onOpenVideo
}: {
  language: ArchiveLanguage;
  media: MediaRecord;
  onOpen: () => void;
  onOpenVideo: () => void;
}) {
  const [setContainerRef, isNearViewport] = useDeferredVisibility<HTMLElement>();
  const imageObjectUrl = useObjectUrl(
    media.media_type === "image" && media.storage_status === "ready" ? media.opfs_path : null,
    isNearViewport
  );
  const previewObjectUrl = useObjectUrl(
    media.media_type === "video" &&
      media.storage_status === "ready" &&
      (media.preview_image_opfs_path ?? null) !== null
      ? media.preview_image_opfs_path
      : null,
    isNearViewport
  );

  if (media.storage_status === "failed") {
    return (
      <div className="post-media-status post-media-status-error" ref={setContainerRef}>
        <strong>
          {media.media_type === "video"
            ? language === "ja"
              ? "動画の保存に失敗しました。"
              : "Video save failed."
            : language === "ja"
              ? "画像の保存に失敗しました。"
              : "Image save failed."}
        </strong>
        <span>
          {media.last_error ??
            (language === "ja" ? "不明なメディアエラーです。" : "Unknown media error.")}
        </span>
      </div>
    );
  }

  if (media.media_type === "video") {
    const previewSource = previewObjectUrl ?? media.preview_image_url ?? null;

    return (
      <figure className="post-media-card post-media-card-video" ref={setContainerRef}>
        <button
          className="post-media-button post-media-video-button"
          type="button"
          aria-label={language === "ja" ? "動画を再生" : "Play video"}
          onClick={() => {
            onOpenVideo();
          }}
        >
          {previewSource !== null ? (
            <img
              className="post-media-image"
              src={previewSource}
              alt=""
              loading="lazy"
              decoding="async"
              width={media.width ?? undefined}
              height={media.height ?? undefined}
            />
          ) : (
            <div className="post-media-video-fallback">{language === "ja" ? "動画" : "Video"}</div>
          )}
          <span className="post-media-video-badge">
            {language === "ja" ? "動画を再生" : "Play video"}
          </span>
        </button>
      </figure>
    );
  }

  if (media.storage_status === "pending" || imageObjectUrl === null) {
    return (
      <div className="post-media-status" ref={setContainerRef}>
        {language === "ja" ? "画像を準備中です。" : "Image is still being prepared."}
      </div>
    );
  }

  return (
    <figure className="post-media-card" ref={setContainerRef}>
      <button
        className="post-media-button"
        type="button"
        aria-label={language === "ja" ? "画像を拡大表示" : "Open image"}
        onClick={() => {
          onOpen();
        }}
      >
        <img
          className="post-media-image"
          src={imageObjectUrl}
          alt={media.alt_text ?? ""}
          loading="lazy"
          decoding="async"
          width={media.width ?? undefined}
          height={media.height ?? undefined}
        />
      </button>
      {media.alt_text !== null && <figcaption className="post-media-alt">{media.alt_text}</figcaption>}
    </figure>
  );
}

function formatPostedAt(postedAt: number, language: ArchiveLanguage): string {
  return new Intl.DateTimeFormat(language === "ja" ? "ja-JP" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(postedAt);
}

function formatSavedAt(savedAt: number, language: ArchiveLanguage): string {
  return new Intl.DateTimeFormat(language === "ja" ? "ja-JP" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(savedAt);
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
    return language === "ja" ? "0件" : "0 posts";
  }

  if (hasMorePosts) {
    return language === "ja"
      ? `${formatCount(loadedCount, language)} / ${formatCount(totalCount, language)}件`
      : `${formatCount(loadedCount, language)} / ${formatCount(totalCount, language)} posts`;
  }

  return language === "ja"
    ? `${formatCount(totalCount, language)}件`
    : `${formatCount(totalCount, language)} posts`;
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

function moveActiveMedia(activeMedia: ActiveMedia | null, delta: number): ActiveMedia | null {
  if (activeMedia === null || activeMedia.items.length <= 1) {
    return activeMedia;
  }

  const nextIndex = Math.min(
    activeMedia.items.length - 1,
    Math.max(0, activeMedia.currentIndex + delta)
  );

  return {
    ...activeMedia,
    currentIndex: nextIndex
  };
}

function LightboxImage({
  media,
  language
}: {
  media: MediaRecord | null;
  language: ArchiveLanguage;
}) {
  const objectUrl = useObjectUrl(media?.opfs_path ?? null, media !== null);

  if (media === null || objectUrl === null) {
    return (
      <div className="post-media-status">
        {language === "ja" ? "画像を読み込み中..." : "Loading image..."}
      </div>
    );
  }

  return (
    <img
      className="media-lightbox-image"
      src={objectUrl}
      alt={media.alt_text ?? ""}
      decoding="async"
    />
  );
}

function getSettingsTabOptions(language: ArchiveLanguage) {
  return [
    {
      tab: "basic" as const,
      label: language === "ja" ? "基本設定" : "General"
    },
    {
      tab: "tags" as const,
      label: language === "ja" ? "タグ管理" : "Tags"
    },
    {
      tab: "tag-rules" as const,
      label: language === "ja" ? "自動タグ変換" : "Redirects"
    },
    {
      tab: "backup" as const,
      label: language === "ja" ? "バックアップ" : "Backup"
    },
    {
      tab: "log" as const,
      label: language === "ja" ? "ログ" : "Log"
    }
  ];
}

function getSettingsTabButtonId(tab: SettingsTab): string {
  return `viewer-settings-tab-${tab}`;
}

function getSettingsTabPanelId(tab: SettingsTab): string {
  return `viewer-settings-panel-${tab}`;
}

function useDeferredVisibility<T extends Element>(): [(node: T | null) => void, boolean] {
  const [node, setNode] = useState<T | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (node === null || isVisible) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: "300px 0px"
      }
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [isVisible, node]);

  return [setNode, isVisible];
}

function useObjectUrl(opfsPath: string | null, enabled: boolean): string | null {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || opfsPath === null) {
      setObjectUrl(null);
      return undefined;
    }

    const targetPath = opfsPath;
    let cancelled = false;
    let createdUrl: string | null = null;

    setObjectUrl(null);

    async function loadObjectUrl() {
      try {
        const blob = await readBlobFromOpfs(targetPath);
        createdUrl = URL.createObjectURL(blob);

        if (!cancelled) {
          setObjectUrl(createdUrl);
          return;
        }

        URL.revokeObjectURL(createdUrl);
      } catch (error) {
        logger.error("media.object_url.load_failed", {
          message: "Failed to load media from OPFS.",
          context: {
            opfsPath: targetPath,
            error
          }
        });
      }
    }

    void loadObjectUrl();

    return () => {
      cancelled = true;

      if (createdUrl !== null) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [enabled, opfsPath]);

  return objectUrl;
}
