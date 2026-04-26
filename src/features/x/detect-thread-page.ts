export type ThreadPageContext = {
  opUsername: string;
  focalPostId: string;
};

const THREAD_STATUS_PATH_PATTERN = /^\/([^/]+)\/status\/(\d+)(?:\/|$)/;

export function detectThreadPage(url: string = window.location.href): ThreadPageContext | null {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(url);
  } catch {
    return null;
  }

  if (parsedUrl.hostname !== "x.com" && parsedUrl.hostname !== "twitter.com") {
    return null;
  }

  const match = parsedUrl.pathname.match(THREAD_STATUS_PATH_PATTERN);

  if (match === null) {
    return null;
  }

  const [, username, postId] = match;

  if (username === undefined || postId === undefined) {
    return null;
  }

  return {
    opUsername: username.toLowerCase(),
    focalPostId: postId
  };
}
