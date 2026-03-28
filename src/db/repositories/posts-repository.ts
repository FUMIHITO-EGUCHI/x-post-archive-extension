import { archiveDb } from "../archive-database";
import type { PostRecord } from "../../types/archive";

export async function getPost(xPostId: string): Promise<PostRecord | undefined> {
  return archiveDb.posts.get(xPostId);
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

export async function deletePostRecord(xPostId: string): Promise<void> {
  await archiveDb.posts.delete(xPostId);
}
