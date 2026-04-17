import Dexie, { type Table } from "dexie";
import type {
  MediaRecord,
  PostRecord,
  PostTagRecord,
  TagRecord,
  TagRedirectRecord
} from "../types/archive";
import type { LogRecord } from "../types/logger";
import type { RefetchQueueRecord } from "../types/refetch";
import { resolveKnownBuiltInTagKey } from "../features/settings/archive-language";
import { ARCHIVE_DB_NAME } from "./constants";

// Keep shared DB constants in Dexie-free modules so content scripts never import this file transitively.
export class ArchiveDatabase extends Dexie {
  posts!: Table<PostRecord, string>;
  media!: Table<MediaRecord, string>;
  tags!: Table<TagRecord, string>;
  tag_redirects!: Table<TagRedirectRecord, string>;
  post_tags!: Table<PostTagRecord, string>;
  logs!: Table<LogRecord, string>;
  refetch_queue!: Table<RefetchQueueRecord, string>;

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

    this.version(10).stores({
      posts: "&x_post_id, saved_at, posted_at, reply_count, repost_count, like_count, display_name",
      media: "&media_id, x_post_id, [x_post_id+position], storage_status, saved_at",
      tags: "&tag_id, &normalized_name, system_key, display_name, created_at",
      post_tags:
        "&post_tag_id, x_post_id, tag_id, normalized_name, [x_post_id+normalized_name], source, system_key, assigned_at",
      logs: "&log_id, created_at, level, [level+created_at], scope, event, request_id"
    });

    this.version(11).stores({
      posts: "&x_post_id, saved_at, posted_at, reply_count, repost_count, like_count, display_name",
      media: "&media_id, x_post_id, [x_post_id+position], storage_status, saved_at",
      tags: "&tag_id, &normalized_name, system_key, display_name, created_at",
      tag_redirects:
        "&tag_redirect_id, &source_normalized_name, source_display_name, target_tag_id, created_at",
      post_tags:
        "&post_tag_id, x_post_id, tag_id, normalized_name, [x_post_id+normalized_name], source, system_key, assigned_at",
      logs: "&log_id, created_at, level, [level+created_at], scope, event, request_id"
    });

    this.version(12).stores({
      posts: "&x_post_id, saved_at, posted_at, reply_count, repost_count, like_count, display_name",
      media: "&media_id, x_post_id, [x_post_id+position], storage_status, saved_at",
      tags: "&tag_id, &normalized_name, system_key, display_name, created_at",
      tag_redirects:
        "&tag_redirect_id, &source_normalized_name, source_display_name, target_tag_id, created_at",
      post_tags:
        "&post_tag_id, x_post_id, tag_id, normalized_name, [x_post_id+normalized_name], source, system_key, assigned_at",
      logs: "&log_id, created_at, level, [level+created_at], scope, event, request_id",
      refetch_queue: "&x_post_id, status, priority, enqueued_at, completed_at"
    });

    this.version(13).stores({
      posts:
        "&x_post_id, saved_at, posted_at, reply_count, repost_count, like_count, display_name, quoted_post_id",
      media: "&media_id, x_post_id, [x_post_id+position], storage_status, saved_at",
      tags: "&tag_id, &normalized_name, system_key, display_name, created_at",
      tag_redirects:
        "&tag_redirect_id, &source_normalized_name, source_display_name, target_tag_id, created_at",
      post_tags:
        "&post_tag_id, x_post_id, tag_id, normalized_name, [x_post_id+normalized_name], source, system_key, assigned_at",
      logs: "&log_id, created_at, level, [level+created_at], scope, event, request_id",
      refetch_queue: "&x_post_id, status, priority, enqueued_at, completed_at"
    });

    this.version(14).stores({
      posts:
        "&x_post_id, saved_at, posted_at, reply_count, repost_count, like_count, display_name, quoted_post_id, x_username, [x_username+saved_at]",
      media: "&media_id, x_post_id, [x_post_id+position], storage_status, saved_at, media_type",
      tags: "&tag_id, &normalized_name, system_key, display_name, created_at",
      tag_redirects:
        "&tag_redirect_id, &source_normalized_name, source_display_name, target_tag_id, created_at",
      post_tags:
        "&post_tag_id, x_post_id, tag_id, normalized_name, [x_post_id+normalized_name], source, system_key, assigned_at",
      logs: "&log_id, created_at, level, [level+created_at], scope, event, request_id",
      refetch_queue: "&x_post_id, status, priority, enqueued_at, completed_at"
    });
  }
}

export const archiveDb = new ArchiveDatabase();
let objectStoreNamesPromise: Promise<Set<string>> | null = null;

export function isMissingObjectStoreError(error: unknown): boolean {
  const name =
    typeof error === "object" && error !== null && "name" in error
      ? String(error.name)
      : null;
  const message = error instanceof Error ? error.message : String(error);
  const normalizedMessage = message.toLocaleLowerCase("en-US");

  return (
    name === "NotFoundError" &&
    (normalizedMessage.includes("object store") || normalizedMessage.includes("objectstore")) &&
    normalizedMessage.includes("not found")
  ) ||
    message.includes("The specified object store was not found.");
}

export async function getArchiveObjectStoreNames(): Promise<Set<string>> {
  if (objectStoreNamesPromise === null) {
    objectStoreNamesPromise = archiveDb.open().then(() => {
      const nativeDb = archiveDb.backendDB();
      nativeDb.addEventListener("versionchange", () => {
        objectStoreNamesPromise = null;
      });
      nativeDb.addEventListener("close", () => {
        objectStoreNamesPromise = null;
      });
      return new Set(Array.from(nativeDb.objectStoreNames));
    });
  }

  return objectStoreNamesPromise;
}

export async function hasArchiveObjectStore(storeName: string): Promise<boolean> {
  return (await getArchiveObjectStoreNames()).has(storeName);
}

function normalizeStoredCount(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}
