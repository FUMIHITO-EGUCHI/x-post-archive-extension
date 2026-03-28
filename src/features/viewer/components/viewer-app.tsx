import { useEffect, useState } from "react";
import type { PostRecord } from "../../../types/archive";
import { requestDeletePost, requestPosts } from "../../runtime/client";

type ViewerStatus = "idle" | "loading" | "ready";

export function ViewerApp() {
  const [posts, setPosts] = useState<PostRecord[]>([]);
  const [status, setStatus] = useState<ViewerStatus>("idle");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [loadNotice, setLoadNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPosts() {
      setStatus("loading");
      setLoadNotice(null);

      try {
        const response = await requestPosts();

        if (!cancelled) {
          setPosts(response.posts);
          setStatus("ready");
        }
      } catch (error) {
        console.error("Failed to load posts.", error);

        if (!cancelled) {
          setPosts([]);
          setStatus("ready");
          setLoadNotice("Posts could not be loaded. Showing an empty list.");
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
          Saved posts are listed here in descending order of saved time.
        </p>
      </section>

      <section className="viewer-list-panel">
        <div className="viewer-list-header">
          <h2>Archive</h2>
          <span>{posts.length} posts</span>
        </div>

        {status === "loading" && <p className="viewer-message">Loading saved posts...</p>}
        {loadNotice !== null && (
          <p className="viewer-message viewer-message-error">{loadNotice}</p>
        )}
        {status === "ready" && posts.length === 0 && (
          <p className="viewer-message">No saved posts.</p>
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
                    {deletingId === post.x_post_id ? "Deleting..." : "Delete"}
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
