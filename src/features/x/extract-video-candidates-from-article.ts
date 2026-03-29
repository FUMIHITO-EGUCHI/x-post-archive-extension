import type { SaveVideoCandidateInput, VideoDownloadMode } from "../../types/archive";

const MP4_HOSTNAME = "video.twimg.com";
const HLS_PATH_PATTERN = /\.m3u8($|\?)/i;
const MP4_PATH_PATTERN = /\.mp4($|\?)/i;

export function extractVideoCandidatesFromArticle(
  article: HTMLElement
): SaveVideoCandidateInput[] {
  const videos = article.querySelectorAll<HTMLVideoElement>("video");
  const candidates: SaveVideoCandidateInput[] = [];
  const seenKeys = new Set<string>();

  for (const video of videos) {
    const candidate = extractVideoCandidate(video);

    if (candidate === null) {
      continue;
    }

    const dedupeKey = `${candidate.download_mode}:${candidate.source_url}`;

    if (seenKeys.has(dedupeKey)) {
      continue;
    }

    seenKeys.add(dedupeKey);
    candidates.push(candidate);
  }

  return candidates;
}

function extractVideoCandidate(video: HTMLVideoElement): SaveVideoCandidateInput | null {
  const resolvedSource = resolveVideoSource(video);

  if (resolvedSource === null) {
    return null;
  }

  const sourceUrl = normalizeVideoUrl(resolvedSource.src);

  if (sourceUrl === null) {
    return null;
  }

  const downloadMode = detectDownloadMode(sourceUrl);

  if (downloadMode === null) {
    return null;
  }

  return {
    source_url: sourceUrl,
    poster_url: normalizePosterUrl(video.poster),
    thumbnail_url: normalizePosterUrl(video.poster),
    width: normalizeDimension(video.videoWidth || video.clientWidth),
    height: normalizeDimension(video.videoHeight || video.clientHeight),
    duration_sec: normalizeDuration(video.duration),
    mime_type: normalizeMimeType(resolvedSource.type ?? video.getAttribute("type")),
    download_mode: downloadMode,
    variant_key: buildVariantKey(sourceUrl, downloadMode)
  };
}

function resolveVideoSource(
  video: HTMLVideoElement
): {
  src: string;
  type: string | null;
} | null {
  const directSrc = video.currentSrc || video.src;

  if (directSrc.trim() !== "") {
    return {
      src: directSrc,
      type: video.getAttribute("type")
    };
  }

  const source = video.querySelector<HTMLSourceElement>("source[src]");

  if (source !== null && source.src.trim() !== "") {
    return {
      src: source.src,
      type: source.getAttribute("type")
    };
  }

  return null;
}

function normalizeVideoUrl(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl, window.location.origin);

    if (url.hostname !== MP4_HOSTNAME) {
      return null;
    }

    url.protocol = "https:";
    return url.toString();
  } catch {
    return null;
  }
}

function detectDownloadMode(sourceUrl: string): VideoDownloadMode | null {
  if (MP4_PATH_PATTERN.test(sourceUrl)) {
    return "direct_mp4";
  }

  if (HLS_PATH_PATTERN.test(sourceUrl)) {
    return "hls";
  }

  return null;
}

function normalizePosterUrl(rawUrl: string): string | null {
  if (rawUrl.trim() === "") {
    return null;
  }

  try {
    const url = new URL(rawUrl, window.location.origin);
    url.protocol = "https:";
    return url.toString();
  } catch {
    return null;
  }
}

function normalizeDimension(value: number): number | null {
  return Number.isFinite(value) && value > 0 ? value : null;
}

function normalizeDuration(value: number): number | null {
  return Number.isFinite(value) && value > 0 ? value : null;
}

function normalizeMimeType(value: string | null): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized === "" ? null : normalized;
}

function buildVariantKey(sourceUrl: string, downloadMode: VideoDownloadMode): string | null {
  try {
    const url = new URL(sourceUrl);
    return `${downloadMode}:${url.pathname}`;
  } catch {
    return null;
  }
}
