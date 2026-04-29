import { archiveDb } from "../archive-database";
import Dexie from "dexie";
import type { PostRecord } from "../../types/archive";
import type { PostPageCursor, PostSortField, SortDirection } from "../../types/viewer";

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

export async function listSinglePostIds(): Promise<string[]> {
  return (
    await archiveDb.posts
      .filter((post) => normalizePostId(post.thread_root_id) === null)
      .primaryKeys()
  ).map(String);
}

export async function listThreadRootPostIds(): Promise<string[]> {
  return (
    await archiveDb.posts
      .filter((post) => normalizePostId(post.thread_root_id) === post.x_post_id)
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
  sortField: PostSortField,
  sortDirection: SortDirection,
  offset: number,
  limit: number,
  cursor: PostPageCursor | null = null
): Promise<{
  posts: PostRecord[];
  nextCursor: PostPageCursor | null;
}> {
  if (sortField === "random") {
    throw new Error("Random ordering requires a viewer-provided seed and should be resolved upstream.");
  }

  const canUseCursor =
    cursor !== null &&
    cursor.sortField === sortField &&
    cursor.sortDirection === sortDirection &&
    (sortField === "saved_at" || sortField === "posted_at");

  const ordered = canUseCursor
    ? sortDirection === "desc"
      ? archiveDb.posts.where(sortField).below(cursor.value).reverse()
      : archiveDb.posts.where(sortField).above(cursor.value)
    : sortDirection === "desc"
      ? archiveDb.posts.orderBy(sortField).reverse().offset(offset)
      : archiveDb.posts.orderBy(sortField).offset(offset);

  const posts = await ordered.limit(limit).toArray();

  return {
    posts,
    nextCursor: buildPostPageCursor(posts, sortField, sortDirection, limit)
  };
}

function buildPostPageCursor(
  posts: PostRecord[],
  sortField: PostSortField,
  sortDirection: SortDirection,
  limit: number
): PostPageCursor | null {
  if (posts.length < limit || (sortField !== "saved_at" && sortField !== "posted_at")) {
    return null;
  }

  const lastPost = posts[posts.length - 1];

  if (lastPost === undefined) {
    return null;
  }

  return {
    sortField,
    sortDirection,
    value: lastPost[sortField],
    xPostId: lastPost.x_post_id
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
