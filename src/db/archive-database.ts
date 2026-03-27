import Dexie, { type Table } from "dexie";
import type { PostRecord } from "../types/archive";

export class ArchiveDatabase extends Dexie {
  posts!: Table<PostRecord, string>;

  constructor() {
    super("x-post-archive");

    this.version(1).stores({
      posts: "&x_post_id, saved_at"
    });
  }
}

export const archiveDb = new ArchiveDatabase();
