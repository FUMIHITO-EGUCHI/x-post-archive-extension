import type { CSSProperties } from "react";
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
type ViewerScreen = "archive" | "settings";
type FontSizeOption = "small" | "medium" | "large";
type PostSortField = "posted_at" | "saved_at" | "reply_count" | "repost_count" | "like_count";
type SortDirection = "desc" | "asc";
type ActiveMedia = {
  items: MediaRecord[];
  currentIndex: number;
};
type ActiveVideo = {
  media: MediaRecord;
  objectUrl: string | null;
  status: "loading" | "ready" | "error";
};
type StorageEstimateState = {
  usage: number | null;
  quota: number | null;
  available: number | null;
  status: "idle" | "ready" | "unsupported";
};

const VIEWER_FONT_SIZE_STORAGE_KEY = "viewer.fontSize";
const FONT_SIZE_SCALE: Record<FontSizeOption, number> = {
  small: 0.92,
  medium: 1,
  large: 1.12
};

export function ViewerApp() {
  const [screen, setScreen] = useState<ViewerScreen>("archive");
  const [fontSize, setFontSize] = useState<FontSizeOption>("medium");
  const [posts, setPosts] = useState<ArchivePostRecord[]>([]);
  const [sortField, setSortField] = useState<PostSortField>("saved_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [status, setStatus] = useState<ViewerStatus>("idle");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [loadNotice, setLoadNotice] = useState<string | null>(null);
  const [activeMedia, setActiveMedia] = useState<ActiveMedia | null>(null);
  const [activeVideo, setActiveVideo] = useState<ActiveVideo | null>(null);
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  const [tagDrafts, setTagDrafts] = useState<Record<string, string>>({});
  const [tagActionPostId, setTagActionPostId] = useState<string | null>(null);
  const [storageEstimate, setStorageEstimate] = useState<StorageEstimateState>({
    usage: null,
    quota: null,
    available: null,
    status: "idle"
  });
  const activeVideoUrlRef = useRef<string | null>(null);

  const viewerScale = FONT_SIZE_SCALE[fontSize];

  const filteredPosts = useMemo(
    () =>
      activeTagFilter === null
        ? posts
        : posts.filter((post) =>
            post.tags.some((tag) => tag.normalized_name === activeTagFilter)
          ),
    [activeTagFilter, posts]
  );

  const visiblePosts = useMemo(
    () => sortPosts(filteredPosts, sortField, sortDirection),
    [filteredPosts, sortDirection, sortField]
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

  const archiveSummary = useMemo(() => {
    let imageCount = 0;
    let videoCount = 0;
    let mediaBytes = 0;
    const usernames = new Set<string>();
    const tagNames = new Set<string>();

    for (const post of posts) {
      usernames.add(post.x_username);

      for (const tag of post.tags) {
        tagNames.add(tag.normalized_name);
      }

      for (const media of post.media) {
        if (media.media_type === "image") {
          imageCount += 1;
        } else if (media.media_type === "video") {
          videoCount += 1;
        }

        mediaBytes += media.byte_size ?? 0;
      }
    }

    return {
      postCount: posts.length,
      imageCount,
      videoCount,
      mediaCount: imageCount + videoCount,
      accountCount: usernames.size,
      tagCount: tagNames.size,
      mediaBytes
    };
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
    let cancelled = false;

    async function loadViewerSettings() {
      const stored = await browser.storage.local.get(VIEWER_FONT_SIZE_STORAGE_KEY);
      const storedValue = stored[VIEWER_FONT_SIZE_STORAGE_KEY];

      if (!cancelled && isFontSizeOption(storedValue)) {
        setFontSize(storedValue);
      }
    }

    void loadViewerSettings();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadStorageEstimate() {
      if (typeof navigator.storage?.estimate !== "function") {
        if (!cancelled) {
          setStorageEstimate({
            usage: null,
            quota: null,
            available: null,
            status: "unsupported"
          });
        }

        return;
      }

      try {
        const result = await navigator.storage.estimate();
        const usage = typeof result.usage === "number" ? result.usage : null;
        const quota = typeof result.quota === "number" ? result.quota : null;

        if (!cancelled) {
          setStorageEstimate({
            usage,
            quota,
            available: usage !== null && quota !== null ? Math.max(quota - usage, 0) : null,
            status: "ready"
          });
        }
      } catch (error) {
        console.warn("Storage estimate is unavailable.", error);

        if (!cancelled) {
          setStorageEstimate({
            usage: null,
            quota: null,
            available: null,
            status: "unsupported"
          });
        }
      }
    }

    void loadStorageEstimate();

    return () => {
      cancelled = true;
    };
  }, [posts.length, archiveSummary.mediaBytes]);

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

  async function handleFontSizeChange(nextValue: FontSizeOption) {
    setFontSize(nextValue);

    try {
      await browser.storage.local.set({
        [VIEWER_FONT_SIZE_STORAGE_KEY]: nextValue
      });
    } catch (error) {
      console.error("Failed to persist viewer font size.", error);
    }
  }

  return (
    <main
      className="viewer-shell"
      style={
        {
          "--viewer-font-scale": viewerScale
        } as CSSProperties
      }
    >
      {screen === "archive" ? (
        <>
          <section className="viewer-hero">
            <div className="viewer-eyebrow-row">
              <p className="viewer-eyebrow">Image Archive</p>
              <button
                className="viewer-icon-button"
                type="button"
                aria-label="Open settings"
                onClick={() => {
                  setScreen("settings");
                }}
              >
                <GearIcon />
              </button>
            </div>
            <h1 className="viewer-title">Saved X posts</h1>
            <p className="viewer-copy">
              Saved posts, media, and tags are listed here in descending order of saved time, while
              each card shows the original post time.
            </p>
          </section>

          <section className="viewer-list-panel">
            <div className="viewer-list-header">
              <div className="viewer-list-heading">
                <h2>Archive</h2>
                <span>{visiblePosts.length} posts</span>
              </div>
              <div className="viewer-sort-controls" aria-label="Sort posts">
                <label className="viewer-sort-label">
                  <span>Sort</span>
                  <select
                    className="viewer-sort-select"
                    value={sortField}
                    onChange={(event) => {
                      setSortField(event.currentTarget.value as PostSortField);
                    }}
                  >
                    <option value="posted_at">投稿日</option>
                    <option value="saved_at">登録日</option>
                    <option value="reply_count">リプライ数</option>
                    <option value="repost_count">リポスト数</option>
                    <option value="like_count">いいね数</option>
                  </select>
                </label>
                <button
                  className="viewer-sort-direction-button"
                  type="button"
                  onClick={() => {
                    setSortDirection((current) => (current === "desc" ? "asc" : "desc"));
                  }}
                >
                  {sortDirection === "desc" ? "降順" : "昇順"}
                </button>
              </div>
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
                        tag.normalized_name === activeTagFilter
                          ? "tag-chip tag-chip-active"
                          : "tag-chip"
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
                        <div className="post-date-list">
                          <p className="post-date">
                            <span className="post-date-label">投稿日</span>
                            <span>{formatPostedAt(post.posted_at)}</span>
                          </p>
                          <p className="post-date">
                            <span className="post-date-label">登録日</span>
                            <span>{formatSavedAt(post.saved_at)}</span>
                          </p>
                        </div>
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

                    <dl className="post-metrics" aria-label="Post engagement">
                      <div className="post-metric">
                        <dt>Replies</dt>
                        <dd>{formatCount(post.reply_count)}</dd>
                      </div>
                      <div className="post-metric">
                        <dt>Reposts</dt>
                        <dd>{formatCount(post.repost_count)}</dd>
                      </div>
                      <div className="post-metric">
                        <dt>Likes</dt>
                        <dd>{formatCount(post.like_count)}</dd>
                      </div>
                    </dl>

                    <div className="post-tag-section">
                      {post.tags.length > 0 && (
                        <div className="tag-list">
                          {post.tags.map((tag) => (
                            <span
                              className={
                                tag.source === "manual"
                                  ? "tag-chip tag-chip-manual"
                                  : "tag-chip"
                              }
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
        </>
      ) : (
        <>
          <section className="viewer-hero viewer-settings-hero">
            <div className="viewer-hero-header">
              <button
                className="viewer-icon-button"
                type="button"
                aria-label="Back to archive"
                onClick={() => {
                  setScreen("archive");
                }}
              >
                <ArrowLeftIcon />
              </button>
            </div>
            <p className="viewer-eyebrow">Settings</p>
            <h1 className="viewer-title">Viewer options</h1>
            <p className="viewer-copy">
              Settings will be added here. The navigation shell is in place.
            </p>
          </section>

          <section className="viewer-list-panel viewer-settings-panel">
            <div className="viewer-list-header">
              <h2>Options</h2>
            </div>
            <div className="viewer-settings-grid">
              <section className="viewer-settings-card">
                <div className="viewer-settings-card-header">
                  <h3>Font size</h3>
                  <p>Adjust text size in the archive viewer.</p>
                </div>
                <div className="viewer-font-option-list" role="radiogroup" aria-label="Font size">
                  {(
                    [
                      ["small", "Small"],
                      ["medium", "Medium"],
                      ["large", "Large"]
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      className={
                        fontSize === value
                          ? "viewer-font-option viewer-font-option-active"
                          : "viewer-font-option"
                      }
                      type="button"
                      role="radio"
                      aria-checked={fontSize === value}
                      onClick={() => {
                        void handleFontSizeChange(value);
                      }}
                    >
                      <span>{label}</span>
                      <strong>{formatFontSizePreview(value)}</strong>
                    </button>
                  ))}
                </div>
              </section>

              <section className="viewer-settings-card">
                <div className="viewer-settings-card-header">
                  <h3>Storage usage</h3>
                  <p>Estimated browser-managed storage for this extension.</p>
                </div>
                {storageEstimate.status === "unsupported" ? (
                  <p className="viewer-message">
                    Storage estimate is not available in this environment.
                  </p>
                ) : (
                  <dl className="viewer-settings-metric-list">
                    <div className="viewer-settings-metric">
                      <dt>Used</dt>
                      <dd>{formatBytes(storageEstimate.usage)}</dd>
                    </div>
                    <div className="viewer-settings-metric">
                      <dt>Available</dt>
                      <dd>{formatBytes(storageEstimate.available)}</dd>
                    </div>
                    <div className="viewer-settings-metric">
                      <dt>Estimated quota</dt>
                      <dd>{formatBytes(storageEstimate.quota)}</dd>
                    </div>
                    <div className="viewer-settings-metric">
                      <dt>Saved media total</dt>
                      <dd>{formatBytes(archiveSummary.mediaBytes)}</dd>
                    </div>
                  </dl>
                )}
              </section>

              <section className="viewer-settings-card">
                <div className="viewer-settings-card-header">
                  <h3>Archive summary</h3>
                  <p>Current counts for saved content in this archive.</p>
                </div>
                <dl className="viewer-settings-metric-list">
                  <div className="viewer-settings-metric">
                    <dt>Posts</dt>
                    <dd>{formatCount(archiveSummary.postCount)}</dd>
                  </div>
                  <div className="viewer-settings-metric">
                    <dt>Media</dt>
                    <dd>{formatCount(archiveSummary.mediaCount)}</dd>
                  </div>
                  <div className="viewer-settings-metric">
                    <dt>Images</dt>
                    <dd>{formatCount(archiveSummary.imageCount)}</dd>
                  </div>
                  <div className="viewer-settings-metric">
                    <dt>Videos</dt>
                    <dd>{formatCount(archiveSummary.videoCount)}</dd>
                  </div>
                  <div className="viewer-settings-metric">
                    <dt>Accounts</dt>
                    <dd>{formatCount(archiveSummary.accountCount)}</dd>
                  </div>
                  <div className="viewer-settings-metric">
                    <dt>Tags</dt>
                    <dd>{formatCount(archiveSummary.tagCount)}</dd>
                  </div>
                </dl>
              </section>
            </div>
          </section>
        </>
      )}

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

function isFontSizeOption(value: unknown): value is FontSizeOption {
  return value === "small" || value === "medium" || value === "large";
}

function formatFontSizePreview(value: FontSizeOption): string {
  switch (value) {
    case "small":
      return "90%";
    case "medium":
      return "100%";
    case "large":
      return "112%";
  }
}

function formatBytes(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "Unknown";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let currentValue = value;
  let unitIndex = 0;

  while (currentValue >= 1024 && unitIndex < units.length - 1) {
    currentValue /= 1024;
    unitIndex += 1;
  }

  const digits = currentValue >= 100 || unitIndex === 0 ? 0 : 1;
  return `${currentValue.toFixed(digits)} ${units[unitIndex]}`;
}

function formatCount(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M19.14 12.94a7.43 7.43 0 0 0 .05-.94 7.43 7.43 0 0 0-.05-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.15 7.15 0 0 0-1.63-.94L14.4 2.8a.49.49 0 0 0-.49-.4h-3.84a.49.49 0 0 0-.49.4L9.2 5.32c-.58.22-1.13.53-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.66 8.84a.5.5 0 0 0 .12.64l2.03 1.58a7.43 7.43 0 0 0-.05.94 7.43 7.43 0 0 0 .05.94l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32c.13.22.39.31.6.22l2.39-.96c.5.41 1.05.72 1.63.94l.38 2.52c.05.24.25.4.49.4h3.84c.24 0 .44-.16.49-.4l.38-2.52c.58-.22 1.13-.53 1.63-.94l2.39.96c.22.09.47 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z"
        fill="currentColor"
      />
    </svg>
  );
}

function ArrowLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M14.7 5.3a1 1 0 0 1 0 1.4L10.41 11H20a1 1 0 1 1 0 2h-9.59l4.29 4.3a1 1 0 0 1-1.41 1.4l-6-6a1 1 0 0 1 0-1.4l6-6a1 1 0 0 1 1.41 0Z"
        fill="currentColor"
      />
    </svg>
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

function formatPostedAt(postedAt: number): string {
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(postedAt);
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

function sortPosts(
  posts: ArchivePostRecord[],
  sortField: PostSortField,
  sortDirection: SortDirection
): ArchivePostRecord[] {
  const direction = sortDirection === "desc" ? -1 : 1;

  return [...posts].sort((left, right) => {
    const primaryDifference = compareSortableValue(left[sortField], right[sortField], direction);

    if (primaryDifference !== 0) {
      return primaryDifference;
    }

    return compareSortableValue(left.saved_at, right.saved_at, -1);
  });
}

function compareSortableValue(left: number, right: number, direction: 1 | -1): number {
  if (left === right) {
    return 0;
  }

  return left > right ? direction : -direction;
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
