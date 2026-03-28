import { useEffect, useState } from "react";
import type { ArchivePostRecord, MediaRecord } from "../../../types/archive";
import { readBlobFromOpfs } from "../../media-storage/opfs-media-storage";
import { requestDeletePost, requestPosts } from "../../runtime/client";

type ViewerStatus = "idle" | "loading" | "ready";
type ActiveMediaItem = {
  altText: string | null;
  objectUrl: string;
};
type ActiveMedia = {
  items: ActiveMediaItem[];
  currentIndex: number;
};

export function ViewerApp() {
  const [posts, setPosts] = useState<ArchivePostRecord[]>([]);
  const [status, setStatus] = useState<ViewerStatus>("idle");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [loadNotice, setLoadNotice] = useState<string | null>(null);
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});
  const [activeMedia, setActiveMedia] = useState<ActiveMedia | null>(null);

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

  useEffect(() => {
    let cancelled = false;
    const createdUrls: string[] = [];

    async function loadMediaUrls() {
      const entries = await Promise.all(
        posts.flatMap((post) =>
          post.media
            .filter((media) => media.storage_status === "ready")
            .map(async (media) => {
              try {
                const blob = await readBlobFromOpfs(media.opfs_path);
                const objectUrl = URL.createObjectURL(blob);
                createdUrls.push(objectUrl);
                return [media.media_id, objectUrl] as const;
              } catch (error) {
                console.error("Failed to load media from OPFS.", {
                  mediaId: media.media_id,
                  error
                });
                return null;
              }
            })
        )
      );

      if (!cancelled) {
        setMediaUrls(
          Object.fromEntries(entries.filter((entry): entry is readonly [string, string] => entry !== null))
        );
      }
    }

    setMediaUrls({});

    if (posts.length > 0) {
      void loadMediaUrls();
    }

    return () => {
      cancelled = true;
      createdUrls.forEach((url) => {
        URL.revokeObjectURL(url);
      });
    };
  }, [posts]);

  useEffect(() => {
    if (activeMedia === null) {
      return undefined;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setActiveMedia(null);
        return;
      }

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
        <p className="viewer-eyebrow">Image Archive</p>
        <h1 className="viewer-title">Saved X posts</h1>
        <p className="viewer-copy">
          Saved posts and their images are listed here in descending order of saved time.
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

                {post.post_text.trim() !== "" && <p className="post-text">{post.post_text}</p>}

                {post.media.length > 0 && (
                  <div className="post-media-grid">
                    {post.media.map((media, index) => (
                      <MediaCard
                        key={media.media_id}
                        media={media}
                        objectUrl={mediaUrls[media.media_id] ?? null}
                        onOpen={() => {
                          const items = post.media
                            .map((postMedia) => createActiveMediaItem(postMedia, mediaUrls))
                            .filter((item): item is ActiveMediaItem => item !== null);
                          const currentIndex = items.findIndex(
                            (item) => item.objectUrl === mediaUrls[media.media_id]
                          );

                          if (items.length === 0 || currentIndex < 0) {
                            return;
                          }

                          setActiveMedia({
                            items,
                            currentIndex
                          });
                        }}
                      />
                    ))}
                  </div>
                )}

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

      {activeMedia !== null && (
        <div
          className="media-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Expanded image viewer"
          onClick={() => {
            setActiveMedia(null);
          }}
        >
          {activeMedia.items.length > 1 && (
            <button
              className="media-lightbox-nav media-lightbox-nav-prev"
              type="button"
              aria-label="Show previous image"
              disabled={activeMedia.currentIndex === 0}
              onClick={(event) => {
                event.stopPropagation();
                setActiveMedia((current) => moveActiveMedia(current, -1));
              }}
            >
              Previous
            </button>
          )}
          {activeMedia.items.length > 1 && (
            <button
              className="media-lightbox-nav media-lightbox-nav-next"
              type="button"
              aria-label="Show next image"
              disabled={activeMedia.currentIndex === activeMedia.items.length - 1}
              onClick={(event) => {
                event.stopPropagation();
                setActiveMedia((current) => moveActiveMedia(current, 1));
              }}
            >
              Next
            </button>
          )}
          <button
            className="media-lightbox-close"
            type="button"
            aria-label="Close image viewer"
            onClick={() => {
              setActiveMedia(null);
            }}
          >
            Close
          </button>
          <figure
            className="media-lightbox-panel"
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <img
              className="media-lightbox-image"
              src={activeMedia.items[activeMedia.currentIndex]?.objectUrl ?? ""}
              alt={activeMedia.items[activeMedia.currentIndex]?.altText ?? ""}
            />
            {activeMedia.items[activeMedia.currentIndex]?.altText !== null && (
              <figcaption className="media-lightbox-alt">
                {activeMedia.items[activeMedia.currentIndex]?.altText}
              </figcaption>
            )}
          </figure>
        </div>
      )}
    </main>
  );
}

function MediaCard({
  media,
  objectUrl,
  onOpen
}: {
  media: MediaRecord;
  objectUrl: string | null;
  onOpen: () => void;
}) {
  if (media.storage_status === "failed") {
    return (
      <div className="post-media-status post-media-status-error">
        <strong>Image save failed.</strong>
        <span>{media.last_error ?? "Unknown media error."}</span>
      </div>
    );
  }

  if (media.storage_status === "pending" || objectUrl === null) {
    return <div className="post-media-status">Image is still being prepared.</div>;
  }

  return (
    <figure className="post-media-card">
      <button
        className="post-media-button"
        type="button"
        onClick={() => {
          onOpen();
        }}
      >
        <img
          className="post-media-image"
          src={objectUrl}
          alt={media.alt_text ?? ""}
          width={media.width ?? undefined}
          height={media.height ?? undefined}
        />
      </button>
      {media.alt_text !== null && <figcaption className="post-media-alt">{media.alt_text}</figcaption>}
    </figure>
  );
}

function formatSavedAt(savedAt: number): string {
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(savedAt);
}

function createActiveMediaItem(
  media: MediaRecord,
  mediaUrls: Record<string, string>
): ActiveMediaItem | null {
  const objectUrl = mediaUrls[media.media_id];

  if (media.storage_status !== "ready" || objectUrl === undefined) {
    return null;
  }

  return {
    objectUrl,
    altText: media.alt_text
  };
}

function moveActiveMedia(
  activeMedia: ActiveMedia | null,
  delta: number
): ActiveMedia | null {
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
