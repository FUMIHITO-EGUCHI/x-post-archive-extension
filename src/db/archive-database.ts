import Dexie, { type Table } from "dexie";
import type { PostRecord } from "../types/archive";

const ARCHIVE_DB_NAME = "x-post-archive-posts-v1";

export class ArchiveDatabase extends Dexie {
  posts!: Table<PostRecord, string>;

  constructor() {
    super(ARCHIVE_DB_NAME);

    this.version(1).stores({
      posts: "&x_post_id, saved_at"
    });
  }
}

export const archiveDb = new ArchiveDatabase();
