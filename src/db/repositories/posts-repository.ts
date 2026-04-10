import { archiveDb } from "../archive-database";
import { ARCHIVE_DB_NAME } from "../constants";
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

export async function updatePostFields(
  xPostId: string,
  update: Partial<PostRecord>
): Promise<void> {
  await archiveDb.posts.update(xPostId, update);
}

export async function listPosts(): Promise<PostRecord[]> {
  return archiveDb.posts.orderBy("saved_at").reverse().toArray();
}

export async function countPosts(): Promise<number> {
  return archiveDb.posts.count();
}

export async function listPostIds(): Promise<string[]> {
  return archiveDb.posts.toCollection().primaryKeys();
}

export async function listPostIdsWithZeroEngagementCounts(): Promise<string[]> {
  return new Promise<string[]>((resolve, reject) => {
    const openRequest = indexedDB.open(ARCHIVE_DB_NAME);

    openRequest.onerror = () => {
      reject(openRequest.error ?? new Error("Failed to open the archive database."));
    };

    openRequest.onsuccess = () => {
      const nativeDb = openRequest.result;
      const transaction = nativeDb.transaction("posts", "readonly");
      const store = transaction.objectStore("posts");
      const index = store.index("reply_count");
      const request = index.openCursor(IDBKeyRange.only(0));
      const postIds: string[] = [];

      request.onerror = () => {
        nativeDb.close();
        reject(request.error ?? new Error("Failed to query zero-engagement posts."));
      };

      request.onsuccess = () => {
        const cursor = request.result;

        if (cursor === null) {
          return;
        }

        const post = cursor.value as PostRecord;

        if (post.repost_count === 0 && post.like_count === 0) {
          postIds.push(post.x_post_id);
        }

        cursor.continue();
      };

      transaction.oncomplete = () => {
        nativeDb.close();
        resolve(postIds);
      };

      transaction.onerror = () => {
        nativeDb.close();
        reject(transaction.error ?? new Error("Failed to complete zero-engagement query."));
      };
    };
  });
}

export async function listPostsSliceBySort(
  sortField: PostSortField,
  sortDirection: SortDirection,
  offset: number,
  limit: number
): Promise<PostRecord[]> {
  if (sortField === "random") {
    throw new Error("Random ordering requires a viewer-provided seed and should be resolved upstream.");
  }

  const ordered =
    sortDirection === "desc"
      ? archiveDb.posts.orderBy(sortField).reverse()
      : archiveDb.posts.orderBy(sortField);

  return ordered.offset(offset).limit(limit).toArray();
}

export async function deletePostRecord(xPostId: string): Promise<void> {
  await archiveDb.posts.delete(xPostId);
}
