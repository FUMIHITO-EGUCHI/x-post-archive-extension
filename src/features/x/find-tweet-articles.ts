export function findTweetArticles(root: ParentNode = document): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>('article[data-testid="tweet"]'));
}
