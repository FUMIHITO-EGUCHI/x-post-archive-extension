import { useEffect, useMemo, useRef, useState } from "react";
import type { ArchivePostRecord, ArchiveTagRecord, MediaRecord } from "../../../types/archive";
import { readBlobFromOpfs } from "../../media-storage/opfs-media-storage";
import {
  requestAddPostTag,
  requestDeletePost,
  requestPosts,
  requestRemovePostTag
} from "../../runtime/client";

type ViewerStatus = "idle" | "loading" | "ready";
type ActiveMedia = {
  items: MediaRecord[];
  currentIndex: number;
};
type ActiveVideo = {
  media: MediaRecord;
  objectUrl: string | null;
  status: "loading" | "ready" | "error";
};

export function ViewerApp() {
  const [posts, setPosts] = useState<ArchivePostRecord[]>([]);
  const [status, setStatus] = useState<ViewerStatus>("idle");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [loadNotice, setLoadNotice] = useState<string | null>(null);
  const [activeMedia, setActiveMedia] = useState<ActiveMedia | null>(null);
  const [activeVideo, setActiveVideo] = useState<ActiveVideo | null>(null);
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  const [tagDrafts, setTagDrafts] = useState<Record<string, string>>({});
  const [tagActionPostId, setTagActionPostId] = useState<string | null>(null);
  const activeVideoUrlRef = useRef<string | null>(null);

  const visiblePosts = useMemo(
    () =>
      activeTagFilter === null
        ? posts
        : posts.filter((post) =>
            post.tags.some((tag) => tag.normalized_name === activeTagFilter)
          ),
    [activeTagFilter, posts]
  );

  const availableTags = useMemo(() => {
    const tagMap = new Map<
      string,
      {
        tag: ArchiveTagRecord;
        postCount: number;
      }
    >();

    for (const post of posts) {
      for (const tag of post.tags) {
        const existing = tagMap.get(tag.normalized_name);

        if (existing === undefined) {
          tagMap.set(tag.normalized_name, {
            tag,
            postCount: 1
          });
          continue;
        }

        existing.postCount += 1;
      }
    }

    return [...tagMap.values()].sort((left, right) =>
      left.tag.display_name.localeCompare(right.tag.display_name)
    );
  }, [posts]);

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
        console.error("Failed to load video from OPFS.", {
          mediaId: currentVideo.media.media_id,
          error
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

  async function handleAddTag(xPostId: string) {
    const draft = tagDrafts[xPostId]?.trim() ?? "";

    if (draft === "") {
      return;
    }

    setTagActionPostId(xPostId);

    try {
      const response = await requestAddPostTag(xPostId, draft);
      setPosts((current) =>
        current.map((post) =>
          post.x_post_id === xPostId ? { ...post, tags: response.tags } : post
        )
      );
      setTagDrafts((current) => ({
        ...current,
        [xPostId]: ""
      }));
    } catch (error) {
      console.error("Failed to add tag.", error);
    } finally {
      setTagActionPostId(null);
    }
  }

  async function handleRemoveTag(xPostId: string, tag: ArchiveTagRecord) {
    if (tag.source !== "manual") {
      setActiveTagFilter((current) =>
        current === tag.normalized_name ? null : tag.normalized_name
      );
      return;
    }

    setTagActionPostId(xPostId);

    try {
      const response = await requestRemovePostTag(xPostId, tag.normalized_name);
      setPosts((current) =>
        current.map((post) =>
          post.x_post_id === xPostId ? { ...post, tags: response.tags } : post
        )
      );
    } catch (error) {
      console.error("Failed to remove tag.", error);
    } finally {
      setTagActionPostId(null);
    }
  }

  return (
    <main className="viewer-shell">
      <section className="viewer-hero">
        <p className="viewer-eyebrow">Image Archive</p>
        <h1 className="viewer-title">Saved X posts</h1>
        <p className="viewer-copy">
          Saved posts, media, and tags are listed here in descending order of saved time.
        </p>
      </section>

      <section className="viewer-list-panel">
        <div className="viewer-list-header">
          <h2>Archive</h2>
          <span>{visiblePosts.length} posts</span>
        </div>

        {availableTags.length > 0 && (
          <div className="viewer-tag-filter-panel">
            <div className="viewer-tag-filter-header">
              <h3>Filter by tag</h3>
              {activeTagFilter !== null && (
                <button
                  className="viewer-tag-filter-clear"
                  type="button"
                  onClick={() => {
                    setActiveTagFilter(null);
                  }}
                >
                  Clear
                </button>
              )}
            </div>
            <div className="tag-list">
              {availableTags.map(({ tag, postCount }) => (
                <button
                  key={tag.tag_id}
                  className={
                    tag.normalized_name === activeTagFilter ? "tag-chip tag-chip-active" : "tag-chip"
                  }
                  type="button"
                  onClick={() => {
                    setActiveTagFilter((current) =>
                      current === tag.normalized_name ? null : tag.normalized_name
                    );
                  }}
                >
                  {formatTagFilterLabel(tag.display_name, postCount)}
                </button>
              ))}
            </div>
          </div>
        )}

        {status === "loading" && <p className="viewer-message">Loading saved posts...</p>}
        {loadNotice !== null && (
          <p className="viewer-message viewer-message-error">{loadNotice}</p>
        )}
        {status === "ready" && visiblePosts.length === 0 && (
          <p className="viewer-message">No saved posts.</p>
        )}

        {visiblePosts.length > 0 && (
          <div className="viewer-list">
            {visiblePosts.map((post) => (
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
                    {post.media.map((media) => (
                      <MediaCard
                        key={media.media_id}
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

                <div className="post-tag-section">
                  {post.tags.length > 0 && (
                    <div className="tag-list">
                      {post.tags.map((tag) => (
                        <span
                          className={tag.source === "manual" ? "tag-chip tag-chip-manual" : "tag-chip"}
                          key={`${post.x_post_id}-${tag.tag_id}`}
                        >
                          <button
                            className="tag-chip-button"
                            type="button"
                            onClick={() => {
                              setActiveTagFilter((current) =>
                                current === tag.normalized_name ? null : tag.normalized_name
                              );
                            }}
                          >
                            {tag.display_name}
                          </button>
                          {tag.source === "manual" && (
                            <button
                              className="tag-chip-remove"
                              type="button"
                              aria-label={`Remove tag ${tag.display_name}`}
                              onClick={() => {
                                void handleRemoveTag(post.x_post_id, tag);
                              }}
                              disabled={tagActionPostId === post.x_post_id}
                            >
                              x
                            </button>
                          )}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="tag-editor">
                    <input
                      className="tag-input"
                      type="text"
                      value={tagDrafts[post.x_post_id] ?? ""}
                      placeholder="Add manual tag"
                      onChange={(event) => {
                        const value = event.currentTarget.value;
                        setTagDrafts((current) => ({
                          ...current,
                          [post.x_post_id]: value
                        }));
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void handleAddTag(post.x_post_id);
                        }
                      }}
                    />
                    <button
                      className="tag-add-button"
                      type="button"
                      onClick={() => {
                        void handleAddTag(post.x_post_id);
                      }}
                      disabled={tagActionPostId === post.x_post_id}
                    >
                      {tagActionPostId === post.x_post_id ? "Saving..." : "Add tag"}
                    </button>
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
            <LightboxImage media={activeMedia.items[activeMedia.currentIndex] ?? null} />
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
          className="media-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Expanded video viewer"
          onClick={() => {
            setActiveVideo(null);
          }}
        >
          <button
            className="media-lightbox-close"
            type="button"
            aria-label="Close video viewer"
            onClick={() => {
              setActiveVideo(null);
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
            {activeVideo.status === "loading" && (
              <div className="post-media-status">Loading video...</div>
            )}
            {activeVideo.status === "error" && (
              <div className="post-media-status post-media-status-error">
                <strong>Video load failed.</strong>
                <span>{activeVideo.media.last_error ?? "Unknown media error."}</span>
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

function MediaCard({
  media,
  onOpen,
  onOpenVideo
}: {
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
        <strong>{media.media_type === "video" ? "Video save failed." : "Image save failed."}</strong>
        <span>{media.last_error ?? "Unknown media error."}</span>
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
            <div className="post-media-video-fallback">Video</div>
          )}
          <span className="post-media-video-badge">Play video</span>
        </button>
      </figure>
    );
  }

  if (media.storage_status === "pending" || imageObjectUrl === null) {
    return (
      <div className="post-media-status" ref={setContainerRef}>
        Image is still being prepared.
      </div>
    );
  }

  return (
    <figure className="post-media-card" ref={setContainerRef}>
      <button
        className="post-media-button"
        type="button"
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

function formatSavedAt(savedAt: number): string {
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(savedAt);
}

function formatTagFilterLabel(tagName: string, postCount: number): string {
  return `${tagName}(${postCount})`;
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

function LightboxImage({ media }: { media: MediaRecord | null }) {
  const objectUrl = useObjectUrl(media?.opfs_path ?? null, media !== null);

  if (media === null || objectUrl === null) {
    return <div className="post-media-status">Loading image...</div>;
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
        console.error("Failed to load media from OPFS.", {
          opfsPath: targetPath,
          error
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
