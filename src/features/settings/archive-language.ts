import type { BuiltInTagKey, SavePostInput } from "../../types/archive";

export type ArchiveLanguage = "ja" | "en";
export type DefaultAutoTagKey = BuiltInTagKey;

const ARCHIVE_LANGUAGE_STORAGE_KEY = "archive.language";

const DEFAULT_AUTO_TAG_LABELS: Record<ArchiveLanguage, Record<DefaultAutoTagKey, string>> = {
  ja: {
    liked: "いいね",
    image: "画像",
    video: "動画",
    quoted: "引用"
  },
  en: {
    liked: "liked",
    image: "image",
    video: "video",
    quoted: "quoted"
  }
};

export async function loadArchiveLanguage(): Promise<ArchiveLanguage> {
  const stored = await browser.storage.local.get(ARCHIVE_LANGUAGE_STORAGE_KEY);
  const candidate = stored[ARCHIVE_LANGUAGE_STORAGE_KEY];

  return isArchiveLanguage(candidate) ? candidate : detectDefaultArchiveLanguage();
}

export async function persistArchiveLanguage(language: ArchiveLanguage): Promise<void> {
  await browser.storage.local.set({
    [ARCHIVE_LANGUAGE_STORAGE_KEY]: language
  });
}

export function isArchiveLanguage(value: unknown): value is ArchiveLanguage {
  return value === "ja" || value === "en";
}

export function detectDefaultArchiveLanguage(): ArchiveLanguage {
  const browserLanguage =
    typeof browser.i18n?.getUILanguage === "function"
      ? browser.i18n.getUILanguage()
      : navigator.language;

  return browserLanguage.toLocaleLowerCase("en-US").startsWith("ja") ? "ja" : "en";
}

export function getDefaultAutoTagLabel(
  language: ArchiveLanguage,
  key: DefaultAutoTagKey
): string {
  return DEFAULT_AUTO_TAG_LABELS[language][key];
}

export function localizeKnownAutoTagDisplayName(
  language: ArchiveLanguage,
  systemKey: BuiltInTagKey | null,
  normalizedName: string,
  fallbackDisplayName: string
): string {
  const key = systemKey ?? resolveKnownAutoTagKey(normalizedName, fallbackDisplayName);

  if (key === null) {
    return fallbackDisplayName;
  }

  return getDefaultAutoTagLabel(language, key);
}

export function buildLocalizedDefaultAutoTags(
  language: ArchiveLanguage,
  post: SavePostInput,
  options: {
    includeLikedTag?: boolean;
  } = {}
): string[] {
  const tags = [...(post.auto_tags ?? [])];

  if (options.includeLikedTag) {
    tags.push(getDefaultAutoTagLabel(language, "liked"));
  }

  if (post.media.length > 0) {
    tags.push(getDefaultAutoTagLabel(language, "image"));
  }

  if ((post.video_candidates?.length ?? 0) > 0) {
    tags.push(getDefaultAutoTagLabel(language, "video"));
  }

  if (post.quoted_post_id !== undefined && post.quoted_post_id !== null) {
    tags.push(getDefaultAutoTagLabel(language, "quoted"));
  }

  return dedupeTagNames(tags);
}

function dedupeTagNames(tagNames: string[]): string[] {
  const uniqueTags = new Map<string, string>();

  for (const tagName of tagNames) {
    const normalized = normalizeTagName(tagName);

    if (normalized === null || uniqueTags.has(normalized)) {
      continue;
    }

    uniqueTags.set(normalized, tagName.trim());
  }

  return [...uniqueTags.values()];
}

function normalizeTagName(tagName: string): string | null {
  if (typeof tagName !== "string") {
    return null;
  }

  const normalized = tagName.trim().replace(/^#+/, "").replace(/\s+/g, " ").trim();

  if (normalized === "") {
    return null;
  }

  return normalized.toLocaleLowerCase("en-US");
}

function resolveKnownAutoTagKey(
  normalizedName: string,
  fallbackDisplayName: string
): DefaultAutoTagKey | null {
  const candidates = [normalizedName, normalizeTagName(fallbackDisplayName) ?? ""];

  for (const candidate of candidates) {
    if (candidate === "liked" || candidate === "いいね") {
      return "liked";
    }

    if (candidate === "image" || candidate === "画像") {
      return "image";
    }

    if (candidate === "video" || candidate === "動画") {
      return "video";
    }

    if (candidate === "quoted" || candidate === "引用") {
      return "quoted";
    }
  }

  return null;
}

export function resolveKnownBuiltInTagKey(
  normalizedName: string,
  fallbackDisplayName = normalizedName
): BuiltInTagKey | null {
  return resolveKnownAutoTagKey(normalizedName, fallbackDisplayName);
}
