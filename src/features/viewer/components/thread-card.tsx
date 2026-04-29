import { useState } from "react";
import type { ArchivePostRecord } from "../../../types/archive";
import type { ThreadedPostRecord } from "../../../types/viewer";
import { requestThread } from "../../runtime/client";
import { PostCard, type PostCardProps } from "./post-card";

export function ThreadCard(props: PostCardProps) {
  const { post, language } = props;
  const threadPostCount = post.thread_post_count ?? 1;
  const isThread = threadPostCount > 1;
  const [isExpanded, setIsExpanded] = useState(false);
  const [threadPosts, setThreadPosts] = useState<ArchivePostRecord[] | null>(null);
  const [threadStatus, setThreadStatus] = useState<"idle" | "loading" | "error">("idle");

  async function toggleExpanded(): Promise<void> {
    if (!isThread) {
      return;
    }

    if (isExpanded) {
      setIsExpanded(false);
      return;
    }

    setIsExpanded(true);

    if (threadPosts !== null || threadStatus === "loading") {
      return;
    }

    setThreadStatus("loading");

    try {
      const response = await requestThread(post.x_post_id);
      const flattenedPosts =
        response.thread === null ? [post] : flattenThreadPosts(response.thread);
      setThreadPosts(flattenedPosts);
      setThreadStatus("idle");
    } catch {
      setThreadStatus("error");
    }
  }

  return (
    <section className="thread-card" data-thread-root-id={post.x_post_id}>
      <PostCard {...props} />

      {isThread && (
        <div className="thread-card-controls">
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

function flattenThreadPosts(root: ThreadedPostRecord): ArchivePostRecord[] {
  return [root, ...root.children.flatMap(flattenThreadPosts)];
}
