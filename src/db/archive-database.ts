import Dexie, { type Table } from "dexie";
import type {
  MediaRecord,
  PostRecord,
  PostTagRecord,
  TagRecord
} from "../types/archive";
import type { LogRecord } from "../types/logger";
import { resolveKnownBuiltInTagKey } from "../features/settings/archive-language";

const ARCHIVE_DB_NAME = "x-post-archive-posts-v1";

export class ArchiveDatabase extends Dexie {
  posts!: Table<PostRecord, string>;
  media!: Table<MediaRecord, string>;
  tags!: Table<TagRecord, string>;
  post_tags!: Table<PostTagRecord, string>;
  logs!: Table<LogRecord, string>;

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

    this.version(4)
      .stores({
        posts: "&x_post_id, saved_at, posted_at",
        media: "&media_id, x_post_id, [x_post_id+position], storage_status, saved_at",
        tags: "&tag_id, &normalized_name, display_name, created_at",
        post_tags:
          "&post_tag_id, x_post_id, tag_id, normalized_name, [x_post_id+normalized_name], source, assigned_at"
      })
      .upgrade(async (transaction) => {
        await transaction
          .table<PostRecord, string>("posts")
          .toCollection()
          .modify((post) => {
            post.posted_at =
              typeof post.posted_at === "number" && Number.isFinite(post.posted_at)
                ? post.posted_at
                : post.saved_at;
          });
      });

    this.version(5)
      .stores({
        posts: "&x_post_id, saved_at, posted_at",
        media: "&media_id, x_post_id, [x_post_id+position], storage_status, saved_at",
        tags: "&tag_id, &normalized_name, display_name, created_at",
        post_tags:
          "&post_tag_id, x_post_id, tag_id, normalized_name, [x_post_id+normalized_name], source, assigned_at"
      })
      .upgrade(async (transaction) => {
        await transaction
          .table<PostRecord, string>("posts")
          .toCollection()
          .modify((post) => {
            post.reply_count = normalizeStoredCount(post.reply_count);
            post.repost_count = normalizeStoredCount(post.repost_count);
            post.like_count = normalizeStoredCount(post.like_count);
          });
      });

    this.version(6).stores({
      posts: "&x_post_id, saved_at, posted_at",
      media: "&media_id, x_post_id, [x_post_id+position], storage_status, saved_at",
      tags: "&tag_id, &normalized_name, display_name, created_at",
      post_tags:
        "&post_tag_id, x_post_id, tag_id, normalized_name, [x_post_id+normalized_name], source, assigned_at",
      logs: "&log_id, created_at, level, [level+created_at], scope, event, request_id"
    });

    this.version(7).stores({
      posts: "&x_post_id, saved_at, posted_at, reply_count, repost_count, like_count",
      media: "&media_id, x_post_id, [x_post_id+position], storage_status, saved_at",
      tags: "&tag_id, &normalized_name, display_name, created_at",
      post_tags:
        "&post_tag_id, x_post_id, tag_id, normalized_name, [x_post_id+normalized_name], source, assigned_at",
      logs: "&log_id, created_at, level, [level+created_at], scope, event, request_id"
    });

    this.version(8)
      .stores({
        posts: "&x_post_id, saved_at, posted_at, reply_count, repost_count, like_count, display_name",
        media: "&media_id, x_post_id, [x_post_id+position], storage_status, saved_at",
        tags: "&tag_id, &normalized_name, display_name, created_at",
        post_tags:
          "&post_tag_id, x_post_id, tag_id, normalized_name, [x_post_id+normalized_name], source, assigned_at",
        logs: "&log_id, created_at, level, [level+created_at], scope, event, request_id"
      })
      .upgrade(async (transaction) => {
        await transaction
          .table<PostRecord, string>("posts")
          .toCollection()
          .modify((post) => {
            post.display_name =
              typeof post.display_name === "string" && post.display_name.trim() !== ""
                ? post.display_name.trim()
                : post.x_username;
          });
      });

    this.version(9)
      .stores({
        posts: "&x_post_id, saved_at, posted_at, reply_count, repost_count, like_count, display_name",
        media: "&media_id, x_post_id, [x_post_id+position], storage_status, saved_at",
        tags: "&tag_id, &normalized_name, system_key, display_name, created_at",
        post_tags:
          "&post_tag_id, x_post_id, tag_id, normalized_name, [x_post_id+normalized_name], source, system_key, assigned_at",
        logs: "&log_id, created_at, level, [level+created_at], scope, event, request_id"
      })
      .upgrade(async (transaction) => {
        await transaction
          .table<TagRecord, string>("tags")
          .toCollection()
          .modify((tag) => {
            tag.system_key =
              tag.system_key ?? resolveKnownBuiltInTagKey(tag.normalized_name, tag.display_name);
          });

        await transaction
          .table<PostTagRecord, string>("post_tags")
          .toCollection()
          .modify((postTag) => {
            postTag.system_key =
              postTag.system_key ??
              (postTag.source === "auto"
                ? resolveKnownBuiltInTagKey(postTag.normalized_name, postTag.display_name)
                : null);
          });
      });
  }
}

export const archiveDb = new ArchiveDatabase();

function normalizeStoredCount(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}
