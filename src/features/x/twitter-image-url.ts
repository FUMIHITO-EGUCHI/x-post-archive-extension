const DEFAULT_BASE_URL = "https://x.com";
const TWITTER_IMAGE_HOSTNAME = "pbs.twimg.com";
const TWITTER_MEDIA_PATH_SEGMENT = "/media/";
const TWITTER_IMAGE_EXTENSION_PATTERN = /\.([a-z0-9]+)$/i;

export function canonicalizeTwitterImageUrl(
  rawUrl: string,
  options: {
    baseUrl?: string;
  } = {}
): string | null {
  try {
    const url = new URL(rawUrl, options.baseUrl ?? DEFAULT_BASE_URL);
    url.protocol = "https:";

    if (url.hostname !== TWITTER_IMAGE_HOSTNAME || !url.pathname.includes(TWITTER_MEDIA_PATH_SEGMENT)) {
      return null;
    }

    const canonicalPath = splitTwitterImagePathAndFormat(
      url.pathname,
      normalizeTwitterImageFormat(url.searchParams.get("format"))
    );

    if (canonicalPath === null) {
      return null;
    }

    url.pathname = canonicalPath.pathname;
    url.search = "";

    if (canonicalPath.format !== null) {
      url.searchParams.set("format", canonicalPath.format);
    }

    url.searchParams.set("name", "orig");
    return url.toString();
  } catch {
    return null;
  }
}

function splitTwitterImagePathAndFormat(
  pathname: string,
  queryFormat: string | null
): {
  pathname: string;
  format: string | null;
} | null {
  const trimmedPath = pathname.trim();

  if (trimmedPath === "" || !trimmedPath.includes(TWITTER_MEDIA_PATH_SEGMENT)) {
    return null;
  }

  const extensionMatch = trimmedPath.match(TWITTER_IMAGE_EXTENSION_PATTERN);
  const formatFromPath = normalizeTwitterImageFormat(extensionMatch?.[1] ?? null);
  const canonicalPathname =
    extensionMatch === null ? trimmedPath : trimmedPath.slice(0, -extensionMatch[0].length);

  return {
    pathname: canonicalPathname,
    format: queryFormat ?? formatFromPath
  };
}

function normalizeTwitterImageFormat(value: string | null): string | null {
  if (value === null) {
    return null;
  }

  const normalized = value.trim().replace(/^\./, "").toLowerCase();
  return normalized === "" ? null : normalized;
}
