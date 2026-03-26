import Dexie, { type Table } from "dexie";
import type {
  StoredMediaRef,
  StoredPost,
  StoredPostMetric,
  StoredPostTag,
  StoredTag,
  StoredThread
} from "../types/archive";

export class ArchiveDatabase extends Dexie {
  posts!: Table<StoredPost, string>;
  threads!: Table<StoredThread, string>;
  tags!: Table<StoredTag, string>;
  postTags!: Table<StoredPostTag, string>;
  mediaRefs!: Table<StoredMediaRef, string>;
  postMetrics!: Table<StoredPostMetric, string>;

  constructor() {
    super("x-post-archive");

    this.version(1).stores({
      posts: "id, authorHandle, createdAt, savedAt, threadId",
      threads: "id, rootPostId, authorHandle, savedAt",
      tags: "id, slug, kind, createdAt",
      postTags: "id, postId, tagId, kind, createdAt",
      mediaRefs: "id, postId, mediaType, position",
      postMetrics: "postId, capturedAt"
    });
  }
}

export const archiveDb = new ArchiveDatabase();

