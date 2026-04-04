import { archiveDb } from "../archive-database";
import type { PostRecord } from "../../types/archive";
import type { PostSortField, SortDirection } from "../../types/viewer";

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

export async function hasPost(xPostId: string): Promise<boolean> {
  return (await getPost(xPostId)) !== undefined;
}

export async function addPost(post: PostRecord): Promise<void> {
  await archiveDb.posts.add(post);
}

export async function listPosts(): Promise<PostRecord[]> {
  return archiveDb.posts.orderBy("saved_at").reverse().toArray();
}

export async function countPosts(): Promise<number> {
  return archiveDb.posts.count();
}

export async function listPostsSliceBySort(
  sortField: PostSortField,
  sortDirection: SortDirection,
  offset: number,
  limit: number
): Promise<PostRecord[]> {
  const ordered =
    sortDirection === "desc"
      ? archiveDb.posts.orderBy(sortField).reverse()
      : archiveDb.posts.orderBy(sortField);

  return ordered.offset(offset).limit(limit).toArray();
}

export async function deletePostRecord(xPostId: string): Promise<void> {
  await archiveDb.posts.delete(xPostId);
}
