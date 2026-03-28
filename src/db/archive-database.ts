import Dexie, { type Table } from "dexie";
import type { MediaRecord, PostRecord } from "../types/archive";

const ARCHIVE_DB_NAME = "x-post-archive-posts-v1";

export class ArchiveDatabase extends Dexie {
  posts!: Table<PostRecord, string>;
  media!: Table<MediaRecord, string>;

  constructor() {
    super(ARCHIVE_DB_NAME);

    this.version(1).stores({
      posts: "&x_post_id, saved_at"
    });

    this.version(2).stores({
      posts: "&x_post_id, saved_at",
      media: "&media_id, x_post_id, [x_post_id+position], storage_status, saved_at"
    });
  }
}

export const archiveDb = new ArchiveDatabase();
