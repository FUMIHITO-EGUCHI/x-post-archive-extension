import type { KeyboardEvent as ReactKeyboardEvent, RefObject } from "react";
import { useState } from "react";
import type { ArchiveSettings } from "../../../types/archive";
import type { RefetchStatusRecord } from "../../../types/refetch";
import type {
  ArchiveSummaryRecord,
  FontSizeOption,
  StorageEstimateState,
  ViewerSessionRestoreMode
} from "../../../types/viewer";
import type { ViewerTheme } from "../../../types/viewer";
import type { ArchiveLanguage } from "../../settings/archive-language";
import { SettingsArchiveMaintenancePanel } from "./settings-archive-maintenance-panel";
import { SettingsBasicPanel } from "./settings-basic-panel";
import { SettingsLogPanel } from "./settings-log-panel";
import { SettingsTagManagementPanel } from "./settings-tag-management-panel";
import { SettingsTagRedirectsPanel } from "./settings-tag-redirects-panel";

type SettingsTab = "basic" | "tags" | "tag-rules" | "backup" | "log";

type SettingsScreenProps = {
  language: ArchiveLanguage;
  archiveSettings: ArchiveSettings;
  viewerTheme: ViewerTheme;
  fontSize: FontSizeOption;
  sessionRestoreMode: ViewerSessionRestoreMode;
  storageEstimate: StorageEstimateState;
  archiveSummary: ArchiveSummaryRecord;
  refetchStatus: RefetchStatusRecord;
  backToArchiveButtonRef: RefObject<HTMLButtonElement | null>;
  onBackToArchive: () => void;
  onArchiveSettingsChange: (settings: ArchiveSettings) => Promise<void>;
  onThemeChange: (theme: ViewerTheme) => Promise<void>;
  onLanguageChange: (language: ArchiveLanguage) => Promise<void>;
  onFontSizeChange: (fontSize: FontSizeOption) => Promise<void>;
  onSessionRestoreModeChange: (mode: ViewerSessionRestoreMode) => Promise<void>;
  onClearSavedSession: () => Promise<void>;
  onTagRenamed: (oldName: string, newName: string) => Promise<void>;
  onTagMerged: (sourceName: string, targetName: string) => Promise<void>;
  onRefetchAll: () => Promise<void>;
  onRefetchZeroEngagement: () => Promise<void>;
  onRefetchCancel: () => Promise<void>;
  onRefetchClear: () => Promise<void>;
  onArchiveChanged: () => Promise<void>;
};

export function SettingsScreen({
  language,
  archiveSettings,
  viewerTheme,
  fontSize,
  sessionRestoreMode,
  storageEstimate,
  archiveSummary,
  refetchStatus,
  backToArchiveButtonRef,
  onBackToArchive,
  onArchiveSettingsChange,
  onThemeChange,
  onLanguageChange,
  onFontSizeChange,
  onSessionRestoreModeChange,
  onClearSavedSession,
  onTagRenamed,
  onTagMerged,
  onRefetchAll,
  onRefetchZeroEngagement,
  onRefetchCancel,
  onRefetchClear,
  onArchiveChanged
}: SettingsScreenProps) {
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("basic");
  const settingsTabOptions = getSettingsTabOptions(language);
  const activeSettingsTabPanelId = getSettingsTabPanelId(settingsTab);
  const activeSettingsTabButtonId = getSettingsTabButtonId(settingsTab);

  function handleSettingsTabKeyDown(
    currentIndex: number,
    event: ReactKeyboardEvent<HTMLButtonElement>
  ) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft" && event.key !== "Home" && event.key !== "End") {
      return;
    }

    event.preventDefault();

    if (event.key === "Home") {
      setSettingsTab(settingsTabOptions[0]?.tab ?? "basic");
      return;
    }

    if (event.key === "End") {
      setSettingsTab(settingsTabOptions[settingsTabOptions.length - 1]?.tab ?? "log");
      return;
    }

    const direction = event.key === "ArrowRight" ? 1 : -1;
    const nextIndex =
      (currentIndex + direction + settingsTabOptions.length) % settingsTabOptions.length;

    setSettingsTab(settingsTabOptions[nextIndex]?.tab ?? settingsTab);
  }

  return (
    <>
      <section className="viewer-hero viewer-settings-hero">
        <div className="viewer-hero-header">
          <button
            ref={backToArchiveButtonRef}
            className="viewer-icon-button"
            type="button"
            aria-label={language === "ja" ? "一覧へ戻る" : "Back to archive"}
            onClick={onBackToArchive}
          >
            <ArrowLeftIcon />
          </button>
        </div>
      </section>

      <section className="viewer-list-panel viewer-settings-panel">
        <div className="viewer-list-header">
          <h2>{language === "ja" ? "設定" : "Options"}</h2>
        </div>
        <nav
          className="viewer-settings-tabs"
          aria-label={language === "ja" ? "設定ページ" : "Settings pages"}
          role="tablist"
        >
          {settingsTabOptions.map(({ tab, label }, index) => (
            <button
              key={tab}
              id={getSettingsTabButtonId(tab)}
              type="button"
              className={settingsTab === tab ? "viewer-settings-tab viewer-settings-tab-active" : "viewer-settings-tab"}
              role="tab"
              aria-selected={settingsTab === tab}
              aria-controls={settingsTab === tab ? getSettingsTabPanelId(tab) : undefined}
              tabIndex={settingsTab === tab ? 0 : -1}
              onClick={() => {
                setSettingsTab(tab);
              }}
              onKeyDown={(event) => {
                handleSettingsTabKeyDown(index, event);
              }}
            >
              {label}
            </button>
          ))}
        </nav>
        <div
          className="viewer-settings-grid"
          id={activeSettingsTabPanelId}
          role="tabpanel"
          aria-labelledby={activeSettingsTabButtonId}
        >
          {settingsTab === "basic" && (
            <SettingsBasicPanel
              language={language}
              archiveSettings={archiveSettings}
              currentTheme={viewerTheme}
              fontSize={fontSize}
              sessionRestoreMode={sessionRestoreMode}
              storageEstimate={storageEstimate}
              archiveSummary={archiveSummary}
              onArchiveSettingsChange={onArchiveSettingsChange}
              onThemeChange={onThemeChange}
              onLanguageChange={onLanguageChange}
              onFontSizeChange={onFontSizeChange}
              onSessionRestoreModeChange={onSessionRestoreModeChange}
              onClearSavedSession={onClearSavedSession}
            />
          )}

          {settingsTab === "tags" && (
            <SettingsTagManagementPanel
              language={language}
              onTagRenamed={onTagRenamed}
              onTagMerged={onTagMerged}
            />
          )}

          {settingsTab === "tag-rules" && <SettingsTagRedirectsPanel language={language} />}

          {settingsTab === "backup" && (
            <SettingsArchiveMaintenancePanel
              language={language}
              archiveSummary={{
                postCount: archiveSummary.postCount,
                mediaCount: archiveSummary.mediaCount,
                tagCount: archiveSummary.tagCount
              }}
              refetchStatus={refetchStatus}
              onRefetchAll={onRefetchAll}
              onRefetchZeroEngagement={onRefetchZeroEngagement}
              onRefetchCancel={onRefetchCancel}
              onRefetchClear={onRefetchClear}
              onArchiveChanged={onArchiveChanged}
            />
          )}

          {settingsTab === "log" && <SettingsLogPanel language={language} />}
        </div>
      </section>
    </>
  );
}

function ArrowLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M14.7 5.3a1 1 0 0 1 0 1.4L10.41 11H20a1 1 0 1 1 0 2h-9.59l4.29 4.3a1 1 0 0 1-1.41 1.4l-6-6a1 1 0 0 1 0-1.4l6-6a1 1 0 0 1 1.41 0Z"
        fill="currentColor"
      />
    </svg>
  );
}

function getSettingsTabOptions(language: ArchiveLanguage) {
  return [
    {
      tab: "basic" as const,
      label: language === "ja" ? "基本設定" : "General"
    },
    {
      tab: "tags" as const,
      label: language === "ja" ? "タグ管理" : "Tags"
    },
    {
      tab: "tag-rules" as const,
      label: language === "ja" ? "自動タグ変換" : "Redirects"
    },
    {
      tab: "backup" as const,
      label: language === "ja" ? "バックアップ" : "Backup"
    },
    {
      tab: "log" as const,
      label: language === "ja" ? "ログ" : "Log"
    }
  ];
}

function getSettingsTabButtonId(tab: SettingsTab): string {
  return `viewer-settings-tab-${tab}`;
}

function getSettingsTabPanelId(tab: SettingsTab): string {
  return `viewer-settings-panel-${tab}`;
}
