import { archiveDb } from "../archive-database";
import type { PostRecord, SavePostInput } from "../../types/archive";

export async function hasPost(xPostId: string): Promise<boolean> {
  return (await archiveDb.posts.get(xPostId)) !== undefined;
}

export async function savePost(input: SavePostInput): Promise<{
  status: "saved" | "duplicate";
  post?: PostRecord;
}> {
  validateSavePostInput(input);

  const existing = await archiveDb.posts.get(input.x_post_id);

  if (existing !== undefined) {
    return {
      status: "duplicate",
      post: existing
    };
  }

  const post: PostRecord = {
    ...input,
    saved_at: Date.now()
  };

  await archiveDb.posts.add(post);

  return {
    status: "saved",
    post
  };
}

export async function listPosts(): Promise<PostRecord[]> {
  return archiveDb.posts.orderBy("saved_at").reverse().toArray();
}

export async function deletePost(xPostId: string): Promise<boolean> {
  const existing = await archiveDb.posts.get(xPostId);

  if (existing === undefined) {
    return false;
  }

  await archiveDb.posts.delete(xPostId);
  return true;
}

function validateSavePostInput(input: SavePostInput): void {
  requireNonEmptyString(input.x_post_id, "x_post_id");
  requireNonEmptyString(input.x_username, "x_username");
  requireNonEmptyString(input.post_text, "post_text");
  requireNonEmptyString(input.post_url, "post_url");
}

function requireNonEmptyString(value: string, field: string): void {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Invalid ${field}.`);
  }
}
