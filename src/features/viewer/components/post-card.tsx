import { useEffect, useState } from "react";
import type {
  ArchivePostRecord,
  ArchiveTagRecord,
  MediaRecord
} from "../../../types/archive";
import type { ArchiveTagSummaryRecord } from "../../../types/viewer";
import { createLogger } from "../../logging/logger";
import { readBlobFromOpfs } from "../../media-storage/opfs-media-storage";
import type { ArchiveLanguage } from "../../settings/archive-language";
import { safeHref } from "../utils/safe-href";
import { TagPickerOverlay } from "./tag-picker-overlay";

const logger = createLogger("viewer");

export type PostCardProps = {
  post: ArchivePostRecord;
  language: ArchiveLanguage;
  deletingId: string | null;
  tagActionPostId: string | null;
  tagPickerPostId: string | null;
  refetchCurrentPostId: string | null;
  availableTags: ArchiveTagSummaryRecord[];
  getTagDisplayName: (tag: ArchiveTagRecord) => string;
  onDelete: (xPostId: string) => void;
  onRefetch: (xPostId: string) => void;
  onToggleTagFilter: (normalizedName: string) => void;
  onOpenMedia: (items: MediaRecord[], currentIndex: number) => void;
  onOpenVideo: (media: MediaRecord) => void;
  onToggleTagPicker: (xPostId: string) => void;
  onCloseTagPicker: () => void;
  onAddTag: (xPostId: string, displayName: string) => Promise<void>;
  onRemoveTag: (xPostId: string, normalizedName: string) => Promise<void>;
};

export function PostCard({
  post,
  language,
  deletingId,
  tagActionPostId,
  tagPickerPostId,
  refetchCurrentPostId,
  availableTags,
  getTagDisplayName,
  onDelete,
  onRefetch,
  onToggleTagFilter,
  onOpenMedia,
  onOpenVideo,
  onToggleTagPicker,
  onCloseTagPicker,
  onAddTag,
  onRemoveTag
}: PostCardProps) {
  const threadPostCount = post.thread_post_count ?? 1;
  const postHref = safeHref(post.post_url);

  function openPostImage(media: MediaRecord): void {
    if (media.media_type === "video") {
      return;
    }

    const items = post.media.filter(
      (postMedia) => postMedia.media_type === "image" && postMedia.storage_status === "ready"
    );
    const currentIndex = items.findIndex((item) => item.media_id === media.media_id);

    if (items.length === 0 || currentIndex < 0) {
      return;
    }

    onOpenMedia(items, currentIndex);
  }

  return (
    <article className="post-card" data-post-id={post.x_post_id}>
      <div className="post-card-header">
        <div>
          <p className="post-username">
            <span>{post.display_name}</span>
            <span className="post-handle">@{post.x_username}</span>
            {threadPostCount > 1 && (
              <span className="post-thread-badge">
                {language === "ja"
                  ? `全${formatCount(threadPostCount, language)}件`
                  : `${formatCount(threadPostCount, language)} posts`}
              </span>
            )}
          </p>
          <div className="post-date-list">
            <p className="post-date">
              <span className="post-date-label">{language === "ja" ? "投稿日時" : "Posted"}</span>
              <span>{formatPostedAt(post.posted_at, language)}</span>
            </p>
            <p className="post-date">
              <span className="post-date-label">{language === "ja" ? "保存日時" : "Saved"}</span>
              <span>{formatSavedAt(post.saved_at, language)}</span>
            </p>
          </div>
        </div>
        <div className="post-card-actions">
          <button
            className="post-refetch-button"
            type="button"
            aria-label={
              language === "ja"
                ? `@${post.x_username} の投稿を再取得`
                : `Refetch post by @${post.x_username}`
            }
            onClick={() => {
              onRefetch(post.x_post_id);
            }}
            disabled={refetchCurrentPostId === post.x_post_id}
          >
            {refetchCurrentPostId === post.x_post_id
              ? language === "ja"
                ? "再取得中..."
                : "Refetching..."
              : language === "ja"
                ? "再取得"
                : "Refetch"}
          </button>
          <button
            className="post-delete-button"
            type="button"
            aria-label={
              language === "ja"
                ? `@${post.x_username} の投稿を削除`
                : `Delete post by @${post.x_username}`
            }
            onClick={() => {
              onDelete(post.x_post_id);
            }}
            disabled={deletingId === post.x_post_id}
          >
            {deletingId === post.x_post_id
              ? language === "ja"
                ? "削除中..."
                : "Deleting..."
              : language === "ja"
                ? "削除"
                : "Delete"}
          </button>
        </div>
      </div>

      {post.post_text.trim() !== "" && <p className="post-text">{post.post_text}</p>}

      {post.media.length > 0 && (
        <div className="post-media-grid">
          {post.media.map((media) => (
            <MediaCard
              key={media.media_id}
              language={language}
              media={media}
              onOpen={() => {
                openPostImage(media);
              }}
              onOpenVideo={() => {
                onOpenVideo(media);
              }}
            />
          ))}
        </div>
      )}

      {post.quoted_post !== undefined && (
        <QuotedPostCard
          post={post.quoted_post}
          language={language}
          onOpenMedia={(quotedPost, media) => {
            const items = quotedPost.media.filter(
              (postMedia) => postMedia.media_type === "image" && postMedia.storage_status === "ready"
            );
            const currentIndex = items.findIndex((item) => item.media_id === media.media_id);

            if (items.length === 0 || currentIndex < 0) {
              return;
            }

            onOpenMedia(items, currentIndex);
          }}
          onOpenVideo={onOpenVideo}
        />
      )}

      <dl
        className="post-metrics"
        aria-label={language === "ja" ? "投稿の反応数" : "Post engagement"}
      >
        <div className="post-metric">
          <dt>{language === "ja" ? "返信" : "Replies"}</dt>
          <dd>{formatCount(post.reply_count, language)}</dd>
        </div>
        <div className="post-metric">
          <dt>{language === "ja" ? "リポスト" : "Reposts"}</dt>
          <dd>{formatCount(post.repost_count, language)}</dd>
        </div>
        <div className="post-metric">
          <dt>{language === "ja" ? "いいね" : "Likes"}</dt>
          <dd>{formatCount(post.like_count, language)}</dd>
        </div>
      </dl>

      <div className="post-tag-section">
        <div className="post-tag-toolbar">
          {post.tags.length > 0 && (
            <div className="tag-list">
              {post.tags.map((tag) => (
                <span
                  className={tag.system_key === null ? "tag-chip tag-chip-manual" : "tag-chip"}
                  key={`${post.x_post_id}-${tag.tag_id}`}
                >
                  <button
                    className="tag-chip-button"
                    type="button"
                    onClick={() => {
                      onToggleTagFilter(tag.normalized_name);
                    }}
                  >
                    {getTagDisplayName(tag)}
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="post-tag-picker-anchor">
            <button
              className="post-tag-picker-button"
              type="button"
              aria-label={
                language === "ja"
                  ? `@${post.x_username} の投稿タグを編集`
                  : `Edit tags for post by @${post.x_username}`
              }
              aria-haspopup="dialog"
              aria-expanded={tagPickerPostId === post.x_post_id}
              data-tag-picker-trigger-post-id={post.x_post_id}
              onClick={() => {
                onToggleTagPicker(post.x_post_id);
              }}
              disabled={tagActionPostId === post.x_post_id}
            >
              +
            </button>
            {tagPickerPostId === post.x_post_id && (
              <TagPickerOverlay
                currentPostTags={post.tags}
                allTagSummaries={availableTags}
                onAdd={async (displayName) => {
                  await onAddTag(post.x_post_id, displayName);
                }}
                onRemove={async (normalizedName) => {
                  await onRemoveTag(post.x_post_id, normalizedName);
                }}
                onClose={onCloseTagPicker}
                language={language}
                isPending={tagActionPostId === post.x_post_id}
              />
            )}
          </div>
        </div>
      </div>

      {postHref === undefined ? (
        <span className="post-link">{language === "ja" ? "元投稿を開く" : "Open original post"}</span>
      ) : (
        <a className="post-link" href={postHref} target="_blank" rel="noreferrer">
          {language === "ja" ? "元投稿を開く" : "Open original post"}
        </a>
      )}
    </article>
  );
}

function QuotedPostCard({
  post,
  language,
  onOpenMedia,
  onOpenVideo
}: {
  post: ArchivePostRecord;
  language: ArchiveLanguage;
  onOpenMedia: (post: ArchivePostRecord, media: MediaRecord) => void;
  onOpenVideo: (media: MediaRecord) => void;
}) {
  const postHref = safeHref(post.post_url);

  return (
    <section
      className="quoted-post-card"
      aria-label={language === "ja" ? "引用投稿" : "Quoted post"}
    >
      <div className="quoted-post-header">
        <p className="quoted-post-username">
          <span>{post.display_name}</span>
          <span className="post-handle">@{post.x_username}</span>
        </p>
        <span className="quoted-post-date">{formatPostedAt(post.posted_at, language)}</span>
      </div>

      {post.post_text.trim() !== "" && <p className="quoted-post-text">{post.post_text}</p>}

      {post.media.length > 0 && (
        <div className="quoted-post-media-grid">
          {post.media.map((media) => (
            <MediaCard
              key={media.media_id}
              language={language}
              media={media}
              onOpen={() => {
                if (media.media_type === "video") {
                  return;
                }

                onOpenMedia(post, media);
              }}
              onOpenVideo={() => {
                onOpenVideo(media);
              }}
            />
          ))}
        </div>
      )}

      {postHref === undefined ? (
        <span className="quoted-post-link">
          {language === "ja" ? "引用元を開く" : "Open quoted post"}
        </span>
      ) : (
        <a className="quoted-post-link" href={postHref} target="_blank" rel="noreferrer">
          {language === "ja" ? "引用元を開く" : "Open quoted post"}
        </a>
      )}
    </section>
  );
}

function MediaCard({
  language,
  media,
  onOpen,
  onOpenVideo
}: {
  language: ArchiveLanguage;
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
        <strong>
          {media.media_type === "video"
            ? language === "ja"
              ? "動画の保存に失敗しました。"
              : "Video save failed."
            : language === "ja"
              ? "画像の保存に失敗しました。"
              : "Image save failed."}
        </strong>
        <span>
          {media.last_error ??
            (language === "ja" ? "不明なメディアエラーです。" : "Unknown media error.")}
        </span>
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
          aria-label={language === "ja" ? "動画を再生" : "Play video"}
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
            <div className="post-media-video-fallback">{language === "ja" ? "動画" : "Video"}</div>
          )}
          <span className="post-media-video-badge">
            {language === "ja" ? "動画を再生" : "Play video"}
          </span>
        </button>
      </figure>
    );
  }

  if (media.storage_status === "pending" || imageObjectUrl === null) {
    return (
      <div
        className="post-media-status post-media-skeleton"
        ref={setContainerRef}
        aria-label={language === "ja" ? "画像を準備中" : "Image is being prepared"}
      >
        <span className="viewer-visually-hidden">
          {language === "ja" ? "画像を準備中です。" : "Image is still being prepared."}
        </span>
      </div>
    );
  }

  return (
    <figure className="post-media-card" ref={setContainerRef}>
      <button
        className="post-media-button"
        type="button"
        aria-label={language === "ja" ? "画像を拡大表示" : "Open image"}
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

function formatCount(value: number, language: ArchiveLanguage = "en"): string {
  return new Intl.NumberFormat(language === "ja" ? "ja-JP" : "en-US").format(value);
}

function formatPostedAt(postedAt: number, language: ArchiveLanguage): string {
  return new Intl.DateTimeFormat(language === "ja" ? "ja-JP" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(postedAt);
}

function formatSavedAt(savedAt: number, language: ArchiveLanguage): string {
  return new Intl.DateTimeFormat(language === "ja" ? "ja-JP" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(savedAt);
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
        logger.error("media.object_url.load_failed", {
          message: "Failed to load media from OPFS.",
          context: {
            opfsPath: targetPath,
            error
          }
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
