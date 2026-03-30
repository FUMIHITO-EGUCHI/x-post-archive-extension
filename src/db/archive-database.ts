import Dexie, { type Table } from "dexie";
import type {
  MediaRecord,
  PostRecord,
  PostTagRecord,
  TagRecord
} from "../types/archive";

const ARCHIVE_DB_NAME = "x-post-archive-posts-v1";

export class ArchiveDatabase extends Dexie {
  posts!: Table<PostRecord, string>;
  media!: Table<MediaRecord, string>;
  tags!: Table<TagRecord, string>;
  post_tags!: Table<PostTagRecord, string>;

  constructor() {
    super(ARCHIVE_DB_NAME);

    this.version(1).stores({
      posts: "&x_post_id, saved_at"
    });

    this.version(2).stores({
      posts: "&x_post_id, saved_at",
      media: "&media_id, x_post_id, [x_post_id+position], storage_status, saved_at"
    });

    this.version(3).stores({
      posts: "&x_post_id, saved_at",
      media: "&media_id, x_post_id, [x_post_id+position], storage_status, saved_at",
      tags: "&tag_id, &normalized_name, display_name, created_at",
      post_tags:
        "&post_tag_id, x_post_id, tag_id, normalized_name, [x_post_id+normalized_name], source, assigned_at"
    });
  }
}

export const archiveDb = new ArchiveDatabase();
