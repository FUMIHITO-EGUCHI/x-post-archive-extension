import { archiveDb } from "../archive-database";
import type { ArchiveStats } from "../../types/runtime";

export async function getArchiveStats(): Promise<ArchiveStats> {
  const [posts, threads, tags] = await Promise.all([
    archiveDb.posts.count(),
    archiveDb.threads.count(),
    archiveDb.tags.count()
  ]);

  return {
    posts,
    threads,
    tags
  };
}

