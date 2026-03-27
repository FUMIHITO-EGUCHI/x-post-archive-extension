import { useEffect, useState } from "react";
import type { PostRecord } from "../../../types/archive";
import { requestDeletePost, requestPosts } from "../../runtime/client";

type ViewerStatus = "idle" | "loading" | "ready" | "error";

export function ViewerApp() {
  const [posts, setPosts] = useState<PostRecord[]>([]);
  const [status, setStatus] = useState<ViewerStatus>("idle");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPosts() {
      setStatus("loading");

      try {
        const response = await requestPosts();

        if (!cancelled) {
          setPosts(response.posts);
          setStatus("ready");
        }
      } catch (error) {
        console.error("Failed to load posts.", error);

        if (!cancelled) {
          setStatus("error");
        }
      }
    }

    void loadPosts();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleDelete(xPostId: string) {
    setDeletingId(xPostId);

    try {
      const response = await requestDeletePost(xPostId);

      if (response.deleted) {
        setPosts((current) => current.filter((post) => post.x_post_id !== xPostId));
      }
    } catch (error) {
      console.error("Failed to delete post.", error);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className="viewer-shell">
      <section className="viewer-hero">
        <p className="viewer-eyebrow">Initial Release</p>
        <h1 className="viewer-title">Saved X posts</h1>
        <p className="viewer-copy">
          X 上で保存した投稿を、保存日時の新しい順に一覧表示します。
        </p>
      </section>

      <section className="viewer-list-panel">
        <div className="viewer-list-header">
          <h2>Archive</h2>
          <span>{posts.length} posts</span>
        </div>

        {status === "loading" && <p className="viewer-message">保存済み投稿を読み込み中です。</p>}
        {status === "error" && (
          <p className="viewer-message viewer-message-error">
            一覧の読み込みに失敗しました。拡張を再読み込みして再確認してください。
          </p>
        )}
        {status === "ready" && posts.length === 0 && (
          <p className="viewer-message">まだ保存済み投稿はありません。</p>
        )}

        {posts.length > 0 && (
          <div className="viewer-list">
            {posts.map((post) => (
              <article className="post-card" key={post.x_post_id}>
                <div className="post-card-header">
                  <div>
                    <p className="post-username">@{post.x_username}</p>
                    <p className="post-date">{formatSavedAt(post.saved_at)}</p>
                  </div>
                  <button
                    className="post-delete-button"
                    type="button"
                    onClick={() => {
                      void handleDelete(post.x_post_id);
                    }}
                    disabled={deletingId === post.x_post_id}
                  >
                    {deletingId === post.x_post_id ? "削除中..." : "削除"}
                  </button>
                </div>

                <p className="post-text">{post.post_text}</p>

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
      </section>
    </main>
  );
}

function formatSavedAt(savedAt: number): string {
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(savedAt);
}
