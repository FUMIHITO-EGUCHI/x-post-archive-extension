import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ArchiveTagRecord } from "../../../types/archive";
import type {
  ArchiveSummaryRecord,
  ArchiveTagSummaryRecord,
  DateFilterTarget,
  PostSortField,
  SortDirection,
  UserSummary,
} from "../../../types/viewer";
import {
  requestArchiveSummary,
  requestDeletePost,
  requestTagSummaries,
  requestUserSummaries
} from "../../runtime/client";
import { createLogger } from "../../logging/logger";
import { BulkTagModal } from "./bulk-tag-modal";
import {
  localizeKnownAutoTagDisplayName,
  type ArchiveLanguage
} from "../../settings/archive-language";
import {
  clearViewerSession,
  loadViewerSession,
  persistViewerSession
} from "../viewer-session-storage";
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
import { useViewerPreferences } from "./use-viewer-preferences";
import { useTagOperations } from "./use-tag-operations";
import { useArchiveLoader } from "./use-archive-loader";
import {
  createRandomSeed,
  DEFAULT_DATE_FILTER_TARGET,
  useSortFilter
} from "./use-sort-filter";
import { useFilterModal } from "./use-filter-modal";

type ViewerScreen = "archive" | "settings";
const DEFAULT_PAGE_SIZE = 50;
const MAX_SESSION_RESTORE_LIMIT = 200;
const logger = createLogger("viewer");

export function ViewerApp() {
  const [screen, setScreen] = useState<ViewerScreen>("archive");
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
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isBulkTagModalOpen, setIsBulkTagModalOpen] = useState(false);
  const [userSummaries, setUserSummaries] = useState<UserSummary[]>([]);
  const archiveLoader = useArchiveLoader();
  const mediaLightbox = useMediaLightbox();
  const shouldPersistSessionRef = useRef(false);
  const closeFilterModalRef = useRef<() => void>(() => {});
  const restoreScrollTopRef = useRef<number | null>(null);
  const [restoreTargetPostId, setRestoreTargetPostId] = useState<string | null>(null);
  const archiveSectionRef = useRef<HTMLElement | null>(null);
  const settingsButtonRef = useRef<HTMLButtonElement | null>(null);
  const backToArchiveButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousScreenRef = useRef<ViewerScreen>("archive");
  const {
    posts,
    archiveTotalCount,
    hasMorePosts,
    status,
    isLoadingMore,
    loadNotice,
    loadArchivePage,
    setLoadNotice,
    setInitialLoadError
  } = archiveLoader;
  const sortFilter = useSortFilter({
    loadArchivePage,
    closeFilterModal: () => {
      closeFilterModalRef.current();
    }
  });
  const {
    sortField,
    setSortField,
    sortDirection,
    setSortDirection,
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
    handleApplyDateFilter: applyDateFilter,
    handleClearDateFilter: clearDateFilter,
    handleClearAllFilters: clearAllFilters,
    handleLoadMore: loadMorePosts
  } = sortFilter;
  const preferences = useViewerPreferences({
    archiveMediaBytes: archiveSummary.mediaBytes,
    archivePostCount: archiveSummary.postCount,
    persistCurrentViewerSession
  });
  const {
    language,
    archiveSettings,
    viewerTheme,
    fontSize,
    sessionRestoreMode,
    storageEstimate,
    viewerScale,
    loadViewerPreferences,
    applyViewerPreferences,
    handleLanguageChange,
    handleThemeChange,
    handleFontSizeChange,
    handleArchiveSettingsChange,
    handleSessionRestoreModeChange,
    handleClearSavedSession
  } = preferences;
  const filterModal = useFilterModal({
    activeAuthorFilter,
    activeDateFilterTarget,
    activeDateFrom,
    activeDateTo,
    activeTagFilter,
    availableTags,
    getTagDisplayName,
    language,
    userSummaries
  });
  closeFilterModalRef.current = filterModal.closeFilterModal;
  const {
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
    displayedUserOptions,
    remainingUserOptionCount,
    hasMoreUserOptions,
    loadMoreUserOptions,
    openFilterModal,
    closeFilterModal,
    resetDateFilterDraft
  } = filterModal;
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
  const tagOperations = useTagOperations({
    posts,
    reloadCurrentArchive
  });
  const {
    tagActionPostId,
    tagPickerPostId,
    setTagPickerPostId,
    handleAddTagToPost,
    handleRemoveTagFromPost
  } = tagOperations;

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

  function closeBulkTagModal() {
    setIsBulkTagModalOpen(false);
  }

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

  useEffect(() => {
    let cancelled = false;

    async function initializeViewer() {
      try {
        const [
          preferences,
          savedSession
        ] = await Promise.all([
          loadViewerPreferences(),
          loadViewerSession()
        ]);

        if (cancelled) {
          return;
        }

        const nextSessionRestoreMode = preferences.sessionRestoreMode;
        applyViewerPreferences(preferences);

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
          setInitialLoadError();
        }
      }
    }

    void initializeViewer();

    return () => {
      cancelled = true;
    };
  }, []);

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

  async function handleApplyDateFilter() {
    if (dateFilterDraftError !== null) {
      return;
    }

    const nextDateFrom = normalizeDateInputValue(dateFilterDraftFrom);
    const nextDateTo = normalizeDateInputValue(dateFilterDraftTo);
    const nextDateFilterTarget =
      nextDateFrom === null && nextDateTo === null ? null : dateFilterDraftTarget;

    await applyDateFilter({
      dateFilterTarget: nextDateFilterTarget,
      dateFrom: nextDateFrom,
      dateTo: nextDateTo
    });
  }

  async function handleClearDateFilter() {
    resetDateFilterDraft();
    await clearDateFilter();
  }

  async function handleClearAllFilters() {
    resetDateFilterDraft();
    await clearAllFilters();
  }

  async function handleLoadMore() {
    await loadMorePosts(posts.length);
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

function formatCount(value: number, language: ArchiveLanguage = "en"): string {
  return new Intl.NumberFormat(language === "ja" ? "ja-JP" : "en-US").format(value);
}

function formatUserSummaryLabel(user: UserSummary): string {
  return `${user.display_name} (@${user.screen_name})`;
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

