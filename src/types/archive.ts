export type MediaType = "image" | "video";

export type MediaStorageStatus = "pending" | "ready" | "failed";

export type VideoDownloadMode = "direct_mp4" | "hls";

export type PostRecord = {
  x_post_id: string;
  x_username: string;
  post_text: string;
  post_url: string;
  saved_at: number;
};

export type MediaRecord = {
  media_id: string;
  x_post_id: string;
  media_type: MediaType;
  source_url: string;
  preview_image_url: string | null;
  opfs_path: string;
  position: number;
  alt_text: string | null;
  width: number | null;
  height: number | null;
  mime_type: string | null;
  byte_size: number | null;
  storage_status: MediaStorageStatus;
  saved_at: number;
  last_error: string | null;
};

export type SaveImageInput = {
  source_url: string;
  position: number;
  alt_text: string | null;
  width: number | null;
  height: number | null;
};

export type SaveVideoCandidateInput = {
  source_url: string;
  poster_url: string | null;
  thumbnail_url: string | null;
  width: number | null;
  height: number | null;
  duration_sec: number | null;
  mime_type: string | null;
  download_mode: VideoDownloadMode;
  variant_key: string | null;
};

export type SavePostInput = {
  x_post_id: string;
  x_username: string;
  post_text: string;
  post_url: string;
  media: SaveImageInput[];
  video_candidates?: SaveVideoCandidateInput[];
};

export type ArchivePostRecord = PostRecord & {
  media: MediaRecord[];
};
