import {
  defaultArchiveSettings,
  type ArchiveSettings
} from "../../types/archive";

const ARCHIVE_SETTINGS_STORAGE_KEY = "archiveSettings";

export async function loadArchiveSettings(): Promise<ArchiveSettings> {
  const stored = await browser.storage.local.get(ARCHIVE_SETTINGS_STORAGE_KEY);
  return normalizeArchiveSettings(stored[ARCHIVE_SETTINGS_STORAGE_KEY]);
}

export async function persistArchiveSettings(settings: ArchiveSettings): Promise<void> {
  await browser.storage.local.set({
    [ARCHIVE_SETTINGS_STORAGE_KEY]: normalizeArchiveSettings(settings)
  });
}

function normalizeArchiveSettings(value: unknown): ArchiveSettings {
  if (value === null || typeof value !== "object") {
    return {
      ...defaultArchiveSettings
    };
  }

  return {
    autoArchiveOnLike:
      Reflect.get(value, "autoArchiveOnLike") === true
        ? true
        : defaultArchiveSettings.autoArchiveOnLike,
    autoArchiveOnBookmark:
      Reflect.get(value, "autoArchiveOnBookmark") === true
        ? true
        : defaultArchiveSettings.autoArchiveOnBookmark
  };
}
