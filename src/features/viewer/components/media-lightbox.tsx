import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { MediaRecord } from "../../../types/archive";
import { createLogger } from "../../logging/logger";
import { readBlobFromOpfs } from "../../media-storage/opfs-media-storage";
import type { ArchiveLanguage } from "../../settings/archive-language";
import { useDialogA11y } from "./use-dialog-a11y";

export type ActiveMedia = {
  items: MediaRecord[];
  currentIndex: number;
};

export type ActiveVideo = {
  media: MediaRecord;
  objectUrl: string | null;
  status: "loading" | "ready" | "error";
};

const logger = createLogger("media-lightbox");

export function useMediaLightbox() {
  const [activeMedia, setActiveMedia] = useState<ActiveMedia | null>(null);
  const [activeVideo, setActiveVideo] = useState<ActiveVideo | null>(null);
  const activeVideoUrlRef = useRef<string | null>(null);
  const imageLightboxRef = useRef<HTMLDivElement | null>(null);
  const imageLightboxCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const videoLightboxRef = useRef<HTMLDivElement | null>(null);
  const videoLightboxCloseButtonRef = useRef<HTMLButtonElement | null>(null);

  function closeImageLightbox() {
    setActiveMedia(null);
  }

  function closeVideoLightbox() {
    setActiveVideo(null);
  }

  function moveImageLightbox(delta: number) {
    setActiveMedia((current) => moveActiveMedia(current, delta));
  }

  useDialogA11y({
    isOpen: activeMedia !== null,
    containerRef: imageLightboxRef,
    initialFocusRef: imageLightboxCloseButtonRef,
    onClose: closeImageLightbox
  });
  useDialogA11y({
    isOpen: activeVideo !== null,
    containerRef: videoLightboxRef,
    initialFocusRef: videoLightboxCloseButtonRef,
    onClose: closeVideoLightbox
  });

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

        if (cancelled) {
          URL.revokeObjectURL(createdUrl);
          return;
        }

        activeVideoUrlRef.current = createdUrl;

        setActiveVideo({
          media: currentVideo.media,
          objectUrl: createdUrl,
          status: "ready"
        });
      } catch (error) {
        logger.error("video.load.failed", {
          message: "Failed to load video from OPFS.",
          context: {
            mediaId: currentVideo.media.media_id,
            error
          }
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

  return {
    activeMedia,
    setActiveMedia,
    activeVideo,
    setActiveVideo,
    closeImageLightbox,
    closeVideoLightbox,
    moveImageLightbox,
    imageLightboxRef,
    imageLightboxCloseButtonRef,
    videoLightboxRef,
    videoLightboxCloseButtonRef
  };
}

export function ImageLightboxDialog({
  activeMedia,
  language,
  closeButtonRef,
  dialogRef,
  onClose,
  onMove
}: {
  activeMedia: ActiveMedia;
  language: ArchiveLanguage;
  closeButtonRef: RefObject<HTMLButtonElement | null>;
  dialogRef: RefObject<HTMLDivElement | null>;
  onClose: () => void;
  onMove: (delta: number) => void;
}) {
  const currentMedia = activeMedia.items[activeMedia.currentIndex] ?? null;

  return (
    <div
      ref={dialogRef}
      className="media-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={language === "ja" ? "画像ビューア" : "Image viewer"}
      tabIndex={-1}
      onClick={onClose}
    >
      {activeMedia.items.length > 1 && (
        <button
          className="media-lightbox-nav media-lightbox-nav-prev"
          type="button"
          aria-label={language === "ja" ? "前の画像を表示" : "Show previous image"}
          disabled={activeMedia.currentIndex === 0}
          onClick={(event) => {
            event.stopPropagation();
            onMove(-1);
          }}
        >
          {language === "ja" ? "前へ" : "Previous"}
        </button>
      )}
      {activeMedia.items.length > 1 && (
        <button
          className="media-lightbox-nav media-lightbox-nav-next"
          type="button"
          aria-label={language === "ja" ? "次の画像を表示" : "Show next image"}
          disabled={activeMedia.currentIndex === activeMedia.items.length - 1}
          onClick={(event) => {
            event.stopPropagation();
            onMove(1);
          }}
        >
          {language === "ja" ? "次へ" : "Next"}
        </button>
      )}
      <button
        ref={closeButtonRef}
        className="media-lightbox-close"
        type="button"
        aria-label={language === "ja" ? "画像ビューアを閉じる" : "Close image viewer"}
        onClick={onClose}
      >
        {language === "ja" ? "閉じる" : "Close"}
      </button>
      <figure
        className="media-lightbox-panel"
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <LightboxImage media={currentMedia} language={language} />
        {currentMedia?.alt_text !== null && (
          <figcaption className="media-lightbox-alt">
            {currentMedia?.alt_text}
          </figcaption>
        )}
      </figure>
    </div>
  );
}

export function VideoLightboxDialog({
  activeVideo,
  language,
  closeButtonRef,
  dialogRef,
  onClose
}: {
  activeVideo: ActiveVideo;
  language: ArchiveLanguage;
  closeButtonRef: RefObject<HTMLButtonElement | null>;
  dialogRef: RefObject<HTMLDivElement | null>;
  onClose: () => void;
}) {
  return (
    <div
      ref={dialogRef}
      className="media-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={language === "ja" ? "動画ビューア" : "Video viewer"}
      tabIndex={-1}
      onClick={onClose}
    >
      <button
        ref={closeButtonRef}
        className="media-lightbox-close"
        type="button"
        aria-label={language === "ja" ? "動画ビューアを閉じる" : "Close video viewer"}
        onClick={onClose}
      >
        {language === "ja" ? "閉じる" : "Close"}
      </button>
      <figure
        className="media-lightbox-panel"
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        {activeVideo.status === "loading" && (
          <div className="post-media-status">
            {language === "ja" ? "動画を読み込み中..." : "Loading video..."}
          </div>
        )}
        {activeVideo.status === "error" && (
          <div className="post-media-status post-media-status-error">
            <strong>
              {language === "ja" ? "動画の読み込みに失敗しました。" : "Video load failed."}
            </strong>
            <span>
              {activeVideo.media.last_error ??
                (language === "ja" ? "不明なメディアエラーです。" : "Unknown media error.")}
            </span>
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
  );
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

function LightboxImage({
  media,
  language
}: {
  media: MediaRecord | null;
  language: ArchiveLanguage;
}) {
  const objectUrl = useObjectUrl(media?.opfs_path ?? null, media !== null);

  if (media === null || objectUrl === null) {
    return (
      <div className="post-media-status">
        {language === "ja" ? "画像を読み込み中..." : "Loading image..."}
      </div>
    );
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
