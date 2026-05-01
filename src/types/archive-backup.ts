import type { MediaRecord, PostRecord, PostTagRecord, TagRecord, TagRedirectRecord } from "./archive";

export type ArchiveBackupFileEntry = {
  path: string;
  mime_type: string | null;
  byte_size: number;
};

export type ArchiveBackupManifest = {
  format: "x-post-archive-backup";
  version: 1 | 2;
  exported_at: number;
  data: {
    posts: PostRecord[];
    media: MediaRecord[];
    tags: TagRecord[];
    tag_redirects: TagRedirectRecord[];
    post_tags: PostTagRecord[];
    files: ArchiveBackupFileEntry[];
  };
};

export type ArchiveBackupSummary = {
  postCount: number;
  mediaCount: number;
  tagCount: number;
  tagRedirectCount: number;
  postTagCount: number;
  fileCount: number;
  fileBytes: number;
};
