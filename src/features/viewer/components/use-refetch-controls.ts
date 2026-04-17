import { useEffect, useRef, useState } from "react";
import { DEFAULT_REFETCH_STATUS, type RefetchStatusRecord } from "../../../types/refetch";
import { createLogger } from "../../logging/logger";
import {
  requestRefetchCancel,
  requestRefetchClear,
  requestRefetchEnqueueAll,
  requestRefetchEnqueuePosts,
  requestRefetchEnqueueZeroEngagement,
  requestRefetchStatus
} from "../../runtime/client";
import type { ArchiveLanguage } from "../../settings/archive-language";

const logger = createLogger("refetch-controls");

export function useRefetchControls({
  language,
  onRefetchComplete,
  setLoadNotice
}: {
  language: ArchiveLanguage;
  onRefetchComplete: () => Promise<void>;
  setLoadNotice: (notice: string | null) => void;
}) {
  const [refetchStatus, setRefetchStatus] =
    useState<RefetchStatusRecord>(DEFAULT_REFETCH_STATUS);
  const previousRefetchStatusRef = useRef<RefetchStatusRecord>(DEFAULT_REFETCH_STATUS);
  const onRefetchCompleteRef = useRef(onRefetchComplete);

  useEffect(() => {
    onRefetchCompleteRef.current = onRefetchComplete;
  }, [onRefetchComplete]);

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
          void onRefetchCompleteRef.current();
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

  async function handleRefetchZeroEngagementPosts(): Promise<void> {
    try {
      const response = await requestRefetchEnqueueZeroEngagement(0);
      previousRefetchStatusRef.current = response.status;
      setRefetchStatus(response.status);
    } catch (error) {
      logger.error("refetch.zero_engagement.enqueue_failed", {
        message: "Failed to enqueue zero-engagement refetch.",
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

  return {
    refetchStatus,
    handleRefetchPost,
    handleRefetchAllPosts,
    handleRefetchZeroEngagementPosts,
    handleCancelRefetch,
    handleClearRefetchQueue
  };
}
