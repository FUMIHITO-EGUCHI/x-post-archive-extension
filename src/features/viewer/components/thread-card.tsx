import { useEffect, useRef, useState } from "react";
import type { ArchivePostRecord, MediaRecord } from "../../../types/archive";
import type { ThreadExpandQueueSummary } from "../../../types/thread";
import type { ThreadedPostRecord } from "../../../types/viewer";
import {
  requestRetryThreadExpand,
  requestThread,
  requestThreadExpandQueueStatus
} from "../../runtime/client";
import { PostCard, type PostCardProps as BasePostCardProps } from "./post-card";

type ThreadCardProps = BasePostCardProps & {
  onThreadExpandComplete: () => void;
};

export function ThreadCard(props: ThreadCardProps) {
  const { post, language, onThreadExpandComplete } = props;
  const threadPostCount = post.thread_post_count ?? 1;
  const [threadExpandQueue, setThreadExpandQueue] =
    useState<ThreadExpandQueueSummary | null>(post.thread_expand_queue ?? null);
  const isThread = threadPostCount > 1;
  const shouldShowThreadControls = isThread || threadExpandQueue !== null;
  const [isExpanded, setIsExpanded] = useState(false);
  const [threadPosts, setThreadPosts] = useState<ArchivePostRecord[] | null>(null);
  const [threadStatus, setThreadStatus] = useState<"idle" | "loading" | "error">("idle");
  const [retryStatus, setRetryStatus] = useState<"idle" | "loading" | "error">("idle");
  const onThreadExpandCompleteRef = useRef(onThreadExpandComplete);

  useEffect(() => {
    setThreadExpandQueue(post.thread_expand_queue ?? null);
  }, [post.thread_expand_queue]);

  useEffect(() => {
    onThreadExpandCompleteRef.current = onThreadExpandComplete;
  }, [onThreadExpandComplete]);

  useEffect(() => {
    if (
      threadExpandQueue === null ||
      (threadExpandQueue.status !== "pending" && threadExpandQueue.status !== "in_progress")
    ) {
      return undefined;
    }

    let cancelled = false;
    let timeoutId: number | null = null;

    async function pollThreadExpandQueueStatus() {
      try {
        const response = await requestThreadExpandQueueStatus(post.x_post_id);

        if (cancelled) {
          return;
        }

        setThreadExpandQueue(response.record);

        if (response.record === null) {
          onThreadExpandCompleteRef.current();
          return;
        }
      } catch {
        if (!cancelled) {
          setRetryStatus("error");
        }
      }

      if (!cancelled) {
        timeoutId = window.setTimeout(() => {
          void pollThreadExpandQueueStatus();
        }, 2000);
      }
    }

    timeoutId = window.setTimeout(() => {
      void pollThreadExpandQueueStatus();
    }, 2000);

    return () => {
      cancelled = true;

      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [post.x_post_id, threadExpandQueue]);

  async function loadThreadPosts(): Promise<ArchivePostRecord[] | null> {
    if (!isThread) {
      return [post];
    }

    if (threadPosts !== null) {
      return threadPosts;
    }

    if (threadStatus === "loading") {
      return null;
    }

    setThreadStatus("loading");

    try {
      const response = await requestThread(post.x_post_id);
      const flattenedPosts =
        response.thread === null ? [post] : flattenThreadPosts(response.thread);
      setThreadPosts(flattenedPosts);
      setThreadStatus("idle");
      return flattenedPosts;
    } catch {
      setThreadStatus("error");
      return null;
    }
  }

  async function toggleExpanded(): Promise<void> {
    if (!isThread) {
      return;
    }

    if (isExpanded) {
      setIsExpanded(false);
      return;
    }

    setIsExpanded(true);
    await loadThreadPosts();
  }

  async function openThreadSlideshow(): Promise<void> {
    if (!isThread) {
      return;
    }

    const loadedThreadPosts = await loadThreadPosts();
    if (loadedThreadPosts === null) {
      return;
    }

    const slideshow = createThreadImageSlideshow(loadedThreadPosts);

    if (slideshow.items.length === 0) {
      return;
    }

    props.onOpenMedia(slideshow.items, 0, {
      postIndexByMediaId: slideshow.postIndexByMediaId,
      totalPosts: loadedThreadPosts.length
    });
  }

  async function retryThreadExpand(): Promise<void> {
    if (threadExpandQueue === null || retryStatus === "loading") {
      return;
    }

    setRetryStatus("loading");

    try {
      const response = await requestRetryThreadExpand(post.x_post_id);
      setThreadExpandQueue(response.record);
      setThreadPosts(null);
      setRetryStatus("idle");
    } catch {
      setRetryStatus("error");
    }
  }

  return (
    <section className="thread-card" data-thread-root-id={post.x_post_id}>
      <PostCard {...props} />

      {shouldShowThreadControls && (
        <div className="thread-card-controls">
          {isThread && (
            <>
              <button
                className="viewer-secondary-button thread-card-toggle"
                type="button"
                aria-expanded={isExpanded}
                onClick={() => {
                  void toggleExpanded();
                }}
              >
                {isExpanded
                  ? language === "ja"
                    ? "スレッドを閉じる"
                    : "Collapse thread"
                  : language === "ja"
                    ? "スレッドを展開"
                    : "Expand thread"}
              </button>
              <button
                className="viewer-secondary-button thread-card-toggle"
                type="button"
                onClick={() => {
                  void openThreadSlideshow();
                }}
                disabled={threadStatus === "loading"}
              >
                {language === "ja" ? "スライドで読む" : "Read as slides"}
              </button>
            </>
          )}

          {threadExpandQueue !== null && (
            <div
              className={getThreadExpandStatusClassName(threadExpandQueue.status)}
              role="status"
              aria-live="polite"
            >
              <span>{formatThreadExpandStatus(threadExpandQueue, language)}</span>
              {threadExpandQueue.status === "failed" && (
                <button
                  className="viewer-secondary-button thread-card-toggle"
                  type="button"
                  onClick={() => {
                    void retryThreadExpand();
                  }}
                  disabled={retryStatus === "loading"}
                >
                  {retryStatus === "loading"
                    ? language === "ja"
                      ? "再キュー中..."
                      : "Queueing..."
                    : language === "ja"
                      ? "もう一度"
                      : "Retry"}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {isExpanded && (
        <div className="thread-card-expanded-list">
          {threadStatus === "loading" && (
            <p className="thread-card-status" role="status">
              {language === "ja" ? "スレッドを読み込み中..." : "Loading thread..."}
            </p>
          )}

          {threadStatus === "error" && (
            <p className="thread-card-status thread-card-status-error" role="alert">
              {language === "ja"
                ? "スレッドの読み込みに失敗しました。"
                : "Failed to load thread."}
            </p>
          )}

          {threadStatus !== "loading" &&
            (threadPosts ?? [post]).slice(1).map((threadPost) => (
              <PostCard
                {...props}
                key={threadPost.x_post_id}
                post={threadPost}
              />
            ))}
        </div>
      )}
    </section>
  );
}

function getThreadExpandStatusClassName(status: ThreadExpandQueueSummary["status"]): string {
  return status === "failed"
    ? "thread-expand-state thread-expand-state-failed"
    : "thread-expand-state";
}

function formatThreadExpandStatus(
  record: ThreadExpandQueueSummary,
  language: "ja" | "en"
): string {
  if (record.status === "failed") {
    return language === "ja" ? "再取得失敗" : "Refetch failed";
  }

  return language === "ja" ? "展開待ち" : "Expansion queued";
}

function flattenThreadPosts(root: ThreadedPostRecord): ArchivePostRecord[] {
  return [root, ...root.children.flatMap(flattenThreadPosts)];
}

function createThreadImageSlideshow(posts: ArchivePostRecord[]): {
  items: MediaRecord[];
  postIndexByMediaId: Record<string, number>;
} {
  const postIndexByMediaId: Record<string, number> = {};
  const items = posts.flatMap((threadPost, postIndex) =>
    threadPost.media.filter(isReadyImage).map((media) => {
      postIndexByMediaId[media.media_id] = postIndex + 1;
      return media;
    })
  );

  return {
    items,
    postIndexByMediaId
  };
}

function isReadyImage(media: MediaRecord): boolean {
  return media.media_type === "image" && media.storage_status === "ready";
}
