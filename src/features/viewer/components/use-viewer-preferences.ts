import { useCallback, useEffect, useMemo, useState } from "react";
import type { ArchiveSettings } from "../../../types/archive";
import { defaultArchiveSettings } from "../../../types/archive";
import type {
  FontSizeOption,
  StorageEstimateState,
  ViewerSessionRestoreMode
} from "../../../types/viewer";
import type { ViewerTheme } from "../../../types/viewer";
import { createLogger } from "../../logging/logger";
import {
  loadArchiveLanguage,
  persistArchiveLanguage,
  type ArchiveLanguage
} from "../../settings/archive-language";
import {
  loadArchiveSettings,
  persistArchiveSettings
} from "../../settings/archive-settings";
import { loadViewerTheme, persistViewerTheme } from "../../settings/viewer-theme";
import {
  clearViewerSession,
  loadViewerSessionRestoreMode,
  persistViewerSessionRestoreMode
} from "../viewer-session-storage";

const VIEWER_FONT_SIZE_STORAGE_KEY = "viewer.fontSize";
const FONT_SIZE_SCALE: Record<FontSizeOption, number> = {
  small: 0.92,
  medium: 1,
  large: 1.12
};
const logger = createLogger("viewer-preferences");

export type LoadedViewerPreferences = {
  language: ArchiveLanguage;
  archiveSettings: ArchiveSettings;
  sessionRestoreMode: ViewerSessionRestoreMode;
  viewerTheme: ViewerTheme;
  fontSize: FontSizeOption;
};

export function useViewerPreferences({
  archiveMediaBytes,
  archivePostCount
}: {
  archiveMediaBytes: number;
  archivePostCount: number;
}) {
  const [language, setLanguage] = useState<ArchiveLanguage>("ja");
  const [archiveSettings, setArchiveSettings] =
    useState<ArchiveSettings>(defaultArchiveSettings);
  const [viewerTheme, setViewerTheme] = useState<ViewerTheme>("light");
  const [fontSize, setFontSize] = useState<FontSizeOption>("medium");
  const [sessionRestoreMode, setSessionRestoreMode] =
    useState<ViewerSessionRestoreMode>("filters");
  const [storageEstimate, setStorageEstimate] = useState<StorageEstimateState>({
    usage: null,
    quota: null,
    available: null,
    status: "idle"
  });
  const viewerScale = useMemo(() => FONT_SIZE_SCALE[fontSize], [fontSize]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", viewerTheme);
  }, [viewerTheme]);

  useEffect(() => {
    let cancelled = false;

    async function loadStorageEstimate() {
      if (typeof navigator.storage?.estimate !== "function") {
        if (!cancelled) {
          setStorageEstimate({
            usage: null,
            quota: null,
            available: null,
            status: "unsupported"
          });
        }

        return;
      }

      try {
        const result = await navigator.storage.estimate();
        const usage = typeof result.usage === "number" ? result.usage : null;
        const quota = typeof result.quota === "number" ? result.quota : null;

        if (!cancelled) {
          setStorageEstimate({
            usage,
            quota,
            available: usage !== null && quota !== null ? Math.max(quota - usage, 0) : null,
            status: "ready"
          });
        }
      } catch (error) {
        logger.warn("storage.estimate.unavailable", {
          message: "Storage estimate is unavailable.",
          context: {
            error
          }
        });

        if (!cancelled) {
          setStorageEstimate({
            usage: null,
            quota: null,
            available: null,
            status: "unsupported"
          });
        }
      }
    }

    void loadStorageEstimate();

    return () => {
      cancelled = true;
    };
  }, [archiveMediaBytes, archivePostCount]);

  const loadViewerPreferences = useCallback(async (): Promise<LoadedViewerPreferences> => {
    const [
      storedFont,
      nextLanguage,
      nextArchiveSettings,
      nextSessionRestoreMode,
      nextTheme
    ] = await Promise.all([
      browser.storage.local.get(VIEWER_FONT_SIZE_STORAGE_KEY),
      loadArchiveLanguage(),
      loadArchiveSettings(),
      loadViewerSessionRestoreMode(),
      loadViewerTheme()
    ]);

    const storedFontValue = storedFont[VIEWER_FONT_SIZE_STORAGE_KEY];
    const nextFontSize = isFontSizeOption(storedFontValue) ? storedFontValue : "medium";

    return {
      language: nextLanguage,
      archiveSettings: nextArchiveSettings,
      sessionRestoreMode: nextSessionRestoreMode,
      viewerTheme: nextTheme,
      fontSize: nextFontSize
    };
  }, []);

  const applyViewerPreferences = useCallback((preferences: LoadedViewerPreferences) => {
    setFontSize(preferences.fontSize);
    setLanguage(preferences.language);
    setArchiveSettings(preferences.archiveSettings);
    setSessionRestoreMode(preferences.sessionRestoreMode);
    setViewerTheme(preferences.viewerTheme);
  }, []);

  async function handleSessionRestoreModeChange(
    nextValue: ViewerSessionRestoreMode,
    persistCurrentViewerSession: (overrides?: {
      anchorPostId?: string | null;
      sessionRestoreMode?: ViewerSessionRestoreMode;
      scrollTop?: number;
    }) => Promise<void>
  ) {
    setSessionRestoreMode(nextValue);

    try {
      await persistViewerSessionRestoreMode(nextValue);

      if (nextValue === "off") {
        await clearViewerSession();
        return;
      }

      await persistCurrentViewerSession({
        sessionRestoreMode: nextValue,
        scrollTop: nextValue === "filters-and-position" ? window.scrollY : 0
      });
    } catch (error) {
      logger.error("viewer.session_restore_mode.persist_failed", {
        message: "Failed to persist the session restore preference.",
        context: {
          nextValue,
          error
        }
      });
    }
  }

  async function handleClearSavedSession() {
    try {
      await clearViewerSession();
    } catch (error) {
      logger.error("viewer.session.clear_failed", {
        message: "Failed to clear the saved viewer session.",
        context: {
          error
        }
      });
    }
  }

  async function handleFontSizeChange(nextValue: FontSizeOption) {
    setFontSize(nextValue);

    try {
      await browser.storage.local.set({
        [VIEWER_FONT_SIZE_STORAGE_KEY]: nextValue
      });
    } catch (error) {
      logger.error("viewer.font_size.persist_failed", {
        message: "Failed to persist viewer font size.",
        context: {
          nextValue,
          error
        }
      });
    }
  }

  async function handleLanguageChange(nextValue: ArchiveLanguage) {
    setLanguage(nextValue);

    try {
      await persistArchiveLanguage(nextValue);
    } catch (error) {
      logger.error("viewer.language.persist_failed", {
        message: "Failed to persist archive language.",
        context: {
          nextValue,
          error
        }
      });
    }
  }

  async function handleThemeChange(nextValue: ViewerTheme) {
    setViewerTheme(nextValue);

    try {
      await persistViewerTheme(nextValue);
    } catch (error) {
      logger.error("viewer.theme.persist_failed", {
        message: "Failed to persist viewer theme.",
        context: {
          nextValue,
          error
        }
      });
    }
  }

  async function handleArchiveSettingsChange(nextValue: ArchiveSettings) {
    setArchiveSettings(nextValue);

    try {
      await persistArchiveSettings(nextValue);
    } catch (error) {
      logger.error("viewer.archive_settings.persist_failed", {
        message: "Failed to persist archive settings.",
        context: {
          nextValue,
          error
        }
      });
    }
  }

  return {
    language,
    archiveSettings,
    viewerTheme,
    fontSize,
    sessionRestoreMode,
    storageEstimate,
    viewerScale,
    loadViewerPreferences,
    applyViewerPreferences,
    handleLanguageChange,
    handleThemeChange,
    handleFontSizeChange,
    handleArchiveSettingsChange,
    handleSessionRestoreModeChange,
    handleClearSavedSession
  };
}

function isFontSizeOption(value: unknown): value is FontSizeOption {
  return value === "small" || value === "medium" || value === "large";
}
