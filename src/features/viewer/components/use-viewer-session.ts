import { useCallback, useEffect, useRef, useState } from "react";
import type {
  DateFilterTarget,
  PostSortField,
  SortDirection,
  ViewerSessionRestoreMode
} from "../../../types/viewer";
import { createLogger } from "../../logging/logger";
import {
  clearViewerSession,
  persistViewerSession
} from "../viewer-session-storage";

type ViewerScreen = "archive" | "settings";

export type PersistCurrentViewerSessionOverrides = {
  anchorPostId?: string | null;
  sessionRestoreMode?: ViewerSessionRestoreMode;
  scrollTop?: number;
};

type UseViewerSessionOptions = {
  activeAuthorFilter: string | null;
  activeDateFilterTarget: DateFilterTarget | null;
  activeDateFrom: string | null;
  activeDateTo: string | null;
  activeTagFilter: string | null;
  postsLength: number;
  screen: ViewerScreen;
  sessionRestoreMode: ViewerSessionRestoreMode;
  sortDirection: SortDirection;
  sortField: PostSortField;
};

const logger = createLogger("viewer-session");

export function useViewerSession({
  activeAuthorFilter,
  activeDateFilterTarget,
  activeDateFrom,
  activeDateTo,
  activeTagFilter,
  postsLength,
  screen,
  sessionRestoreMode,
  sortDirection,
  sortField
}: UseViewerSessionOptions) {
  const shouldPersistSessionRef = useRef(false);
  const restoreScrollTopRef = useRef<number | null>(null);
  const [restoreTargetPostId, setRestoreTargetPostId] = useState<string | null>(null);

  const persistCurrentViewerSession = useCallback(
    async (overrides?: PersistCurrentViewerSessionOverrides) => {
      const effectiveSessionRestoreMode = overrides?.sessionRestoreMode ?? sessionRestoreMode;

      if (effectiveSessionRestoreMode === "off") {
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
          loadedCount: postsLength,
          anchorPostId:
            effectiveSessionRestoreMode === "filters-and-position"
              ? overrides?.anchorPostId ?? findCurrentAnchorPostId()
              : null,
          scrollTop:
            effectiveSessionRestoreMode === "filters-and-position"
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
    },
    [
      activeAuthorFilter,
      activeDateFilterTarget,
      activeDateFrom,
      activeDateTo,
      activeTagFilter,
      postsLength,
      sessionRestoreMode,
      sortDirection,
      sortField
    ]
  );

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
  }, [postsLength, restoreTargetPostId]);

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
    persistCurrentViewerSession,
    postsLength,
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
    persistCurrentViewerSession,
    postsLength,
    screen,
    sessionRestoreMode,
    sortDirection,
    sortField
  ]);

  function enableSessionPersistence() {
    shouldPersistSessionRef.current = true;
  }

  function restoreSessionPosition(anchorPostId: string | null, scrollTop: number) {
    restoreScrollTopRef.current = scrollTop;
    setRestoreTargetPostId(anchorPostId);
  }

  return {
    enableSessionPersistence,
    persistCurrentViewerSession,
    restoreSessionPosition
  };
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
