import type { SavePostInput } from "../../types/archive";
import { detectThreadPage, type ThreadPageContext } from "./detect-thread-page";
import { extractPostFromArticle } from "./extract-post-from-article";
import { findTweetArticles } from "./find-tweet-articles";

export function extractThreadPosts(
  root: ParentNode = document,
  pageContext: ThreadPageContext | null = detectThreadPage()
): SavePostInput[] {
  if (pageContext === null) {
    return [];
  }

  const posts = collectOpPosts(root, pageContext.opUsername);

  if (posts.length <= 1) {
    return posts.map((post) => ({
      ...post,
      in_reply_to_post_id: post.in_reply_to_post_id ?? null,
      thread_root_id: null
    }));
  }

  const threadRootId = posts[0]?.x_post_id ?? null;

  if (threadRootId === null) {
    return [];
  }

  return posts.map((post, index) => ({
    ...post,
    in_reply_to_post_id: index === 0 ? null : posts[index - 1]?.x_post_id ?? null,
    thread_root_id: threadRootId
  }));
}

function collectOpPosts(root: ParentNode, opUsername: string): SavePostInput[] {
  const posts: SavePostInput[] = [];
  const seenPostIds = new Set<string>();
  const normalizedOpUsername = opUsername.toLowerCase();

  for (const article of findTweetArticles(root)) {
    const extracted = extractPostFromArticle(article);

    if (extracted === null) {
      continue;
    }

    const post = extracted.post;

    if (post.x_username.toLowerCase() !== normalizedOpUsername) {
      continue;
    }

    if (seenPostIds.has(post.x_post_id)) {
      continue;
    }

    seenPostIds.add(post.x_post_id);
    posts.push(post);
  }

  return posts;
}
