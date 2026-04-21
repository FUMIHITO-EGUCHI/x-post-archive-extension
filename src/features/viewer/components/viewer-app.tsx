import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ArchiveTagRecord } from "../../../types/archive";
import type {
  DateFilterTarget,
  PostSortField,
  SortDirection
} from "../../../types/viewer";
import {
  requestDeletePost
} from "../../runtime/client";
import { createLogger } from "../../logging/logger";
import { BulkTagModal } from "./bulk-tag-modal";
import {
  localizeKnownAutoTagDisplayName,
  type ArchiveLanguage
} from "../../settings/archive-language";
import { loadViewerSession } from "../viewer-session-storage";
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
import { useViewerSession } from "./use-viewer-session";
import { useArchiveMetadata } from "./use-archive-metadata";
import {
  formatArchiveCountLabel,
  formatEmptyArchiveMessage,
  normalizeDateInputValue
} from "./viewer-formatters";

type ViewerScreen = "archive" | "settings";
const DEFAULT_PAGE_SIZE = 50;
const MAX_SESSION_RESTORE_LIMIT = 200;
const logger = createLogger("viewer");

export function ViewerApp() {
  const [screen, setScreen] = useState<ViewerScreen>("archive");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isBulkTagModalOpen, setIsBulkTagModalOpen] = useState(false);
  const [isSearchMode, setIsSearchMode] = useState(false);
  const archiveMetadata = useArchiveMetadata();
  const archiveLoader = useArchiveLoader();
  const mediaLightbox = useMediaLightbox();
  const closeFilterModalRef = useRef<() => void>(() => {});
  const archiveSectionRef = useRef<HTMLElement | null>(null);
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);
  const loadMoreInFlightRef = useRef(false);
  const settingsButtonRef = useRef<HTMLButtonElement | null>(null);
  const backToArchiveButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousScreenRef = useRef<ViewerScreen>("archive");
  const {
    archiveSummary,
    availableTags,
    refreshArchiveMetadata,
    userSummaries
  } = archiveMetadata;
  const {
    posts,
    archiveTotalCount,
    hasMorePosts,
    status,
    isLoadingMore,
    loadNotice,
    loadArchivePage,
    setLoadNotice,
    setInitialLoadError,
    updatePostTags,
    removePostFromCurrentPage
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
    activeExcludeTagFilter,
    setActiveExcludeTagFilter,
    activeAuthorFilter,
    setActiveAuthorFilter,
    activeKeywordFilter,
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
    handleToggleExcludeTagFilter,
    handleToggleAuthorFilter,
    handleApplyDateFilter: applyDateFilter,
    handleClearDateFilter: clearDateFilter,
    handleKeywordChange,
    handleClearAllFilters: clearAllFilters,
    handleLoadMore: loadMorePosts
  } = sortFilter;
  const preferences = useViewerPreferences({
    archiveMediaBytes: archiveSummary.mediaBytes,
    archivePostCount: archiveSummary.postCount
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
  const getTagDisplayName = useCallback((tag: ArchiveTagRecord): string => {
    if (tag.source !== "auto") {
      return tag.display_name;
    }

    return localizeKnownAutoTagDisplayName(
      language,
      tag.system_key ?? null,
      tag.normalized_name,
      tag.display_name
    );
  }, [language]);
  const viewerSession = useViewerSession({
    activeAuthorFilter,
    activeDateFilterTarget,
    activeDateFrom,
    activeDateTo,
    activeExcludeTagFilter,
    activeTagFilter,
    postsLength: posts.length,
    screen,
    sessionRestoreMode,
    sortDirection,
    sortField
  });
  const {
    enableSessionPersistence,
    persistCurrentViewerSession,
    restoreSessionPosition
  } = viewerSession;
  const filterModal = useFilterModal({
    activeAuthorFilter,
    activeDateFilterTarget,
    activeDateFrom,
    activeDateTo,
    activeExcludeTagFilter,
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
    activeExcludeTagFilter,
    activeTagFilter,
    posts,
    refreshArchiveMetadata,
    removePostFromCurrentPage,
    reloadCurrentArchive,
    updatePostTags
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
  const selectedExcludeTagFilter = useMemo(
    () => availableTags.find(({ tag }) => tag.normalized_name === activeExcludeTagFilter) ?? null,
    [activeExcludeTagFilter, availableTags]
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
        let nextExcludeTagFilter: string | null = null;
        let nextAuthorFilter: string | null = null;
        let nextDateFilterTarget: DateFilterTarget | null = null;
        let nextDateFrom: string | null = null;
        let nextDateTo: string | null = null;
        let initialLimit = DEFAULT_PAGE_SIZE;

        if (nextSessionRestoreMode !== "off" && savedSession !== null) {
          nextSortField = savedSession.sortField;
          nextSortDirection = savedSession.sortDirection;
          nextTagFilter = savedSession.activeTagFilter;
          nextExcludeTagFilter = savedSession.activeExcludeTagFilter ?? null;
          nextAuthorFilter = savedSession.activeAuthorFilter ?? null;
          nextDateFilterTarget = savedSession.activeDateFilterTarget ?? null;
          nextDateFrom = savedSession.activeDateFrom ?? null;
          nextDateTo = savedSession.activeDateTo ?? null;

          if (nextExcludeTagFilter === nextTagFilter) {
            nextExcludeTagFilter = null;
          }

          if (nextSessionRestoreMode === "filters-and-position" && nextSortField !== "random") {
            initialLimit = Math.min(
              Math.max(DEFAULT_PAGE_SIZE, savedSession.loadedCount),
              MAX_SESSION_RESTORE_LIMIT
            );
            restoreSessionPosition(savedSession.anchorPostId, savedSession.scrollTop);
          }
        }

        setSortField(nextSortField);
        setSortDirection(nextSortDirection);
        setRandomSeed(nextRandomSeed);
        setActiveTagFilter(nextTagFilter);
        setActiveExcludeTagFilter(nextExcludeTagFilter);
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
            excludeTagFilter: nextExcludeTagFilter,
            authorFilter: nextAuthorFilter,
            dateFilterTarget: nextDateFilterTarget,
            dateFrom: nextDateFrom,
            dateTo: nextDateTo,
            keywordFilter: null,
            append: false
          })
        ]);

        if (!cancelled) {
          enableSessionPersistence();
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
        excludeTagFilter: activeExcludeTagFilter,
        authorFilter: activeAuthorFilter,
        ...getCurrentDateFilterInput(),
        keywordFilter: activeKeywordFilter,
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
    let nextExcludeTagFilter =
      activeExcludeTagFilter === oldNormalizedName ? newNormalizedName : activeExcludeTagFilter;

    if (nextExcludeTagFilter === nextTagFilter) {
      nextExcludeTagFilter = null;
    }

    if (nextTagFilter !== activeTagFilter) {
      setActiveTagFilter(nextTagFilter);
    }
    if (nextExcludeTagFilter !== activeExcludeTagFilter) {
      setActiveExcludeTagFilter(nextExcludeTagFilter);
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
        excludeTagFilter: nextExcludeTagFilter,
        authorFilter: activeAuthorFilter,
        ...getCurrentDateFilterInput(),
        keywordFilter: activeKeywordFilter,
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
    let nextExcludeTagFilter =
      activeExcludeTagFilter === sourceNormalizedName ? targetNormalizedName : activeExcludeTagFilter;

    if (nextExcludeTagFilter === nextTagFilter) {
      nextExcludeTagFilter = null;
    }

    if (nextTagFilter !== activeTagFilter) {
      setActiveTagFilter(nextTagFilter);
    }
    if (nextExcludeTagFilter !== activeExcludeTagFilter) {
      setActiveExcludeTagFilter(nextExcludeTagFilter);
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
        excludeTagFilter: nextExcludeTagFilter,
        authorFilter: activeAuthorFilter,
        ...getCurrentDateFilterInput(),
        keywordFilter: activeKeywordFilter,
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
    setIsSearchMode(false);
    await clearAllFilters();
  }

  const handleLoadMore = useCallback(async () => {
    if (
      screen !== "archive" ||
      status !== "ready" ||
      !hasMorePosts ||
      isLoadingMore ||
      loadMoreInFlightRef.current
    ) {
      return;
    }

    loadMoreInFlightRef.current = true;
    try {
      await loadMorePosts(posts.length);
    } finally {
      loadMoreInFlightRef.current = false;
    }
  }, [hasMorePosts, isLoadingMore, loadMorePosts, posts.length, screen, status]);

  useEffect(() => {
    if (screen !== "archive" || status !== "ready" || !hasMorePosts || isLoadingMore) {
      return;
    }

    const sentinel = loadMoreSentinelRef.current;
    if (sentinel === null) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void handleLoadMore();
        }
      },
      {
        rootMargin: "240px 0px"
      }
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [handleLoadMore, hasMorePosts, isLoadingMore, screen, status]);

  const filterChips: StickyToolbarFilterChip[] = [];

  if (activeAuthorFilter !== null) {
    filterChips.push({
      key: "user"
    });
  }

  if (selectedTagFilter !== null || selectedExcludeTagFilter !== null) {
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
      : selectedTagFilter !== null || selectedExcludeTagFilter !== null
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
            isSearchMode={isSearchMode}
            keywordFilter={activeKeywordFilter}
            language={language}
            onOpenBulkTag={() => {
              setIsBulkTagModalOpen(true);
            }}
            onClearAllFilters={() => {
              void handleClearAllFilters();
            }}
            onOpenFilter={openFilterModal}
            onOpenSearch={() => {
              setIsSearchMode(true);
            }}
            onOpenSettings={() => {
              setScreen("settings");
            }}
            onCloseSearch={() => {
              setIsSearchMode(false);
              void handleKeywordChange(null);
            }}
            onKeywordChange={(keyword) => {
              void handleKeywordChange(keyword);
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
                  selectedExcludeTagFilter,
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
              <div
                ref={loadMoreSentinelRef}
                className="viewer-list-sentinel"
                aria-hidden="true"
              />
            )}

            {isLoadingMore && (
              <div className="viewer-list-footer" role="status" aria-live="polite">
                <span>{language === "ja" ? "読み込み中..." : "Loading..."}</span>
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
          onSessionRestoreModeChange={(nextValue) =>
            handleSessionRestoreModeChange(nextValue, persistCurrentViewerSession)
          }
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
          activeExcludeTagFilter={activeExcludeTagFilter}
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
          onToggleExcludeTagFilter={(normalizedName) => {
            void handleToggleExcludeTagFilter(normalizedName);
          }}
          onUserSearchQueryChange={setUserSearchQuery}
          remainingTagOptionCount={remainingTagOptionCount}
          remainingUserOptionCount={remainingUserOptionCount}
          selectedAuthorFilter={selectedAuthorFilter}
          selectedTagFilter={selectedTagFilter}
          selectedExcludeTagFilter={selectedExcludeTagFilter}
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


