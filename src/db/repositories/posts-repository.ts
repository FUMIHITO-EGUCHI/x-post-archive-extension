import { archiveDb } from "../archive-database";
import Dexie from "dexie";
import type { PostRecord } from "../../types/archive";
import type {
  KeysetPostSortField,
  PostPageCursor,
  PostSortField,
  SortDirection
} from "../../types/viewer";

export async function getPost(xPostId: string): Promise<PostRecord | undefined> {
  return archiveDb.posts.get(xPostId);
}

export async function getPostsByIds(xPostIds: string[]): Promise<PostRecord[]> {
  if (xPostIds.length === 0) {
    return [];
  }

  const records = await archiveDb.posts.bulkGet(xPostIds);
  return records.filter((record): record is PostRecord => record !== undefined);
}

export async function getThread(rootId: string): Promise<PostRecord[]> {
  const posts = await archiveDb.posts.where("thread_root_id").equals(rootId).toArray();
  return sortThreadPosts(rootId, posts);
}

export async function hasPost(xPostId: string): Promise<boolean> {
  return (await getPost(xPostId)) !== undefined;
}

export async function addPost(post: PostRecord): Promise<void> {
  await archiveDb.posts.add(post);
}

export async function updatePostFields(
  xPostId: string,
  update: Partial<PostRecord>
): Promise<void> {
  await archiveDb.posts.update(xPostId, update);
}

export async function countPosts(): Promise<number> {
  return archiveDb.posts.count();
}

export async function countThreadPosts(rootId: string): Promise<number> {
  return archiveDb.posts.where("thread_root_id").equals(rootId).count();
}

export async function countThreadPostsByRoots(rootIds: string[]): Promise<Map<string, number>> {
  const normalizedRootIds = [...new Set(rootIds.map(normalizePostId).filter(isNonNullString))];

  if (normalizedRootIds.length === 0) {
    return new Map();
  }

  const posts = await archiveDb.posts.where("thread_root_id").anyOf(normalizedRootIds).toArray();
  const counts = new Map<string, number>();

  for (const rootId of normalizedRootIds) {
    counts.set(rootId, 0);
  }

  for (const post of posts) {
    const threadRootId = normalizePostId(post.thread_root_id);

    if (threadRootId === null) {
      continue;
    }

    counts.set(threadRootId, (counts.get(threadRootId) ?? 0) + 1);
  }

  return counts;
}

export async function listPostIds(): Promise<string[]> {
  return archiveDb.posts.toCollection().primaryKeys();
}

export async function listRootOrSinglePostIds(): Promise<string[]> {
  return (
    await archiveDb.posts
      .filter((post) => {
        const threadRootId = normalizePostId(post.thread_root_id);
        return threadRootId === null || threadRootId === post.x_post_id;
      })
      .primaryKeys()
  ).map(String);
}

export async function listPostUsernames(): Promise<string[]> {
  return (await archiveDb.posts.orderBy("x_username").uniqueKeys()).map(String);
}

export async function countPostsByUsername(username: string): Promise<number> {
  return archiveDb.posts.where("x_username").equals(username).count();
}

export async function getLatestPostByUsername(
  username: string
): Promise<PostRecord | undefined> {
  return archiveDb.posts
    .where("[x_username+saved_at]")
    .between([username, Dexie.minKey], [username, Dexie.maxKey])
    .last();
}

export async function listPostIdsByUsername(username: string): Promise<string[]> {
  return (await archiveDb.posts.where("x_username").equals(username).primaryKeys()).map(String);
}

export async function listPostIdsByKeyword(keyword: string): Promise<string[]> {
  const lowerKeyword = keyword.toLowerCase();

  return (
    await archiveDb.posts
      .filter((post) => post.post_text.toLowerCase().includes(lowerKeyword))
      .primaryKeys()
  ).map(String);
}

export async function listPostIdsWithZeroEngagementCounts(): Promise<string[]> {
  const posts = await archiveDb.posts.where("reply_count").equals(0).toArray();

  return posts
    .filter((post) => post.repost_count === 0 && post.like_count === 0)
    .map((post) => post.x_post_id);
}

export async function listPostsSliceBySort(
  sortField: KeysetPostSortField,
  sortDirection: SortDirection,
  cursor: PostPageCursor | null,
  limit: number
): Promise<PostRecord[]> {
  const compoundIndex = `[${sortField}+x_post_id]`;
  const cursorMatchesQuery =
    cursor !== null &&
    cursor.sortField === sortField &&
    cursor.sortDirection === sortDirection;
  const cursorKey: [number, string] | null = cursorMatchesQuery
    ? [cursor.value, cursor.xPostId]
    : null;

  const collection =
    cursorKey === null
      ? sortDirection === "desc"
        ? archiveDb.posts.orderBy(compoundIndex).reverse()
        : archiveDb.posts.orderBy(compoundIndex)
      : sortDirection === "desc"
        ? archiveDb.posts.where(compoundIndex).below(cursorKey).reverse()
        : archiveDb.posts.where(compoundIndex).above(cursorKey);

  return collection.limit(limit).toArray();
}

export function buildPostPageCursor(
  post: PostRecord | undefined,
  sortField: PostSortField,
  sortDirection: SortDirection
): PostPageCursor | null {
  if (post === undefined || sortField === "random") {
    return null;
  }

  return {
    sortField,
    sortDirection,
    value: post[sortField],
    xPostId: post.x_post_id
  };
}

export async function deletePostRecord(xPostId: string): Promise<void> {
  await archiveDb.posts.delete(xPostId);
}

function sortThreadPosts(rootId: string, posts: PostRecord[]): PostRecord[] {
  if (posts.length <= 1) {
    return posts;
  }

  const postsById = new Map(posts.map((post) => [post.x_post_id, post] as const));
  const childrenByParentId = new Map<string, PostRecord[]>();

  for (const post of posts) {
    const parentId = normalizePostId(post.in_reply_to_post_id);

    if (parentId === null || !postsById.has(parentId)) {
      continue;
    }

    const siblings = childrenByParentId.get(parentId) ?? [];
    siblings.push(post);
    childrenByParentId.set(parentId, siblings);
  }

  for (const siblings of childrenByParentId.values()) {
    siblings.sort(compareThreadPosts);
  }

  const ordered: PostRecord[] = [];
  const seen = new Set<string>();
  let current = postsById.get(rootId) ?? findThreadRootCandidate(rootId, posts);

  while (current !== undefined && !seen.has(current.x_post_id)) {
    ordered.push(current);
    seen.add(current.x_post_id);
    current = childrenByParentId.get(current.x_post_id)?.find((post) => !seen.has(post.x_post_id));
  }

  const remaining = posts
    .filter((post) => !seen.has(post.x_post_id))
    .sort(compareThreadPosts);

  return [...ordered, ...remaining];
}

function findThreadRootCandidate(rootId: string, posts: PostRecord[]): PostRecord | undefined {
  const postIds = new Set(posts.map((post) => post.x_post_id));
  return (
    posts.find((post) => post.x_post_id === rootId) ??
    posts.find((post) => {
      const parentId = normalizePostId(post.in_reply_to_post_id);
      return parentId === null || !postIds.has(parentId);
    }) ??
    posts.sort(compareThreadPosts)[0]
  );
}

function compareThreadPosts(left: PostRecord, right: PostRecord): number {
  if (left.posted_at !== right.posted_at) {
    return left.posted_at - right.posted_at;
  }

  return left.x_post_id.localeCompare(right.x_post_id);
}

function normalizePostId(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized === "" ? null : normalized;
}

function isNonNullString(value: string | null): value is string {
  return value !== null;
}
