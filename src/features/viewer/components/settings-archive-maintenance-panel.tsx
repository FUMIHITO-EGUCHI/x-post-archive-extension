import { useEffect, useMemo, useState } from "react";
import type { ArchiveBackupSummary } from "../../../types/archive-backup";
import {
  type ArchiveTransferProgress,
  clearArchiveData,
  importArchiveBackupZip,
  resetExtensionState
} from "../../archive/archive-maintenance-service";
import { streamArchiveBackupZip } from "../../archive/archive-maintenance-service";
import { createLogger } from "../../logging/logger";
import type { ArchiveLanguage } from "../../settings/archive-language";

type ArchiveMaintenancePanelProps = {
  language: ArchiveLanguage;
  archiveSummary: {
    postCount: number;
    mediaCount: number;
    tagCount: number;
  };
  onArchiveChanged: () => Promise<void>;
};

type FeedbackTone = "neutral" | "success" | "error" | "warning";

const logger = createLogger("viewer-settings-archive");

export function SettingsArchiveMaintenancePanel({
  language,
  archiveSummary,
  onArchiveChanged
}: ArchiveMaintenancePanelProps) {
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const [backupTone, setBackupTone] = useState<FeedbackTone>("neutral");
  const [backupRunning, setBackupRunning] = useState(false);
  const [restoreHandle, setRestoreHandle] = useState<FileSystemFileHandle | null>(null);
  const [restoreFileName, setRestoreFileName] = useState<string | null>(null);
  const [restoreStatus, setRestoreStatus] = useState<string | null>(null);
  const [restoreTone, setRestoreTone] = useState<FeedbackTone>("neutral");
  const [restoreRunning, setRestoreRunning] = useState(false);
  const [backupProgress, setBackupProgress] = useState<ArchiveTransferProgress | null>(null);
  const [restoreProgress, setRestoreProgress] = useState<ArchiveTransferProgress | null>(null);
  const [deleteStatus, setDeleteStatus] = useState<string | null>(null);
  const [deleteTone, setDeleteTone] = useState<FeedbackTone>("neutral");
  const [deleteRunning, setDeleteRunning] = useState(false);
  const [deleteConfirmStep, setDeleteConfirmStep] = useState<0 | 1 | 2>(0);

  const hasArchive = archiveSummary.postCount > 0 || archiveSummary.mediaCount > 0;
  const isJapanese = language === "ja";
  const isTransferRunning = backupRunning || restoreRunning;
  const deleteSummary = useMemo(
    () =>
      isJapanese
        ? `${formatCount(archiveSummary.postCount, language)} 投稿 / ${formatCount(archiveSummary.mediaCount, language)} メディア / ${formatCount(archiveSummary.tagCount, language)} タグ`
        : `${formatCount(archiveSummary.postCount, language)} posts / ${formatCount(archiveSummary.mediaCount, language)} media / ${formatCount(archiveSummary.tagCount, language)} tags`,
    [archiveSummary.mediaCount, archiveSummary.postCount, archiveSummary.tagCount, isJapanese, language]
  );

  useEffect(() => {
    if (!isTransferRunning) {
      return undefined;
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isTransferRunning]);

  async function handleBackup() {
    setBackupRunning(true);
    setBackupStatus(null);
    setBackupTone("neutral");
    setBackupProgress(null);

    try {
      const fileHandle = await getBackupSaveFileHandle();
      const writable = await fileHandle.createWritable();
      const backup = await streamArchiveBackupZip(writable, (progress) => {
        setBackupProgress(progress);
      });

      setBackupTone("success");
      setBackupStatus(
        isJapanese
          ? `バックアップを書き出しました: ${formatBackupSummary(backup.summary, language)}`
          : `Backup exported: ${formatBackupSummary(backup.summary, language)}`
      );
    } catch (error) {
      logger.error("archive.backup.export.failed", {
        message: "Failed to export archive backup.",
        context: {
          error
        }
      });

      setBackupTone("error");
      setBackupStatus(
        getErrorMessage(error, isJapanese ? "バックアップの書き出しに失敗しました。" : "Backup export failed.")
      );
    } finally {
      setBackupProgress(null);
      setBackupRunning(false);
    }
  }

  async function handleRestore() {
    if (restoreHandle === null) {
      setRestoreTone("warning");
      setRestoreStatus(isJapanese ? "先にバックアップ ZIP を選択してください。" : "Select a backup ZIP file first.");
      return;
    }

    const confirmed = window.confirm(
      isJapanese
        ? "復元すると、現在の保存済みアーカイブは選択したバックアップで置き換えられます。続行しますか？"
        : "Restore will replace the current saved archive with the selected backup. Continue?"
    );

    if (!confirmed) {
      return;
    }

    setRestoreRunning(true);
    setRestoreStatus(null);
    setRestoreTone("neutral");
    setRestoreProgress(null);

    try {
      const restoreFile = await readRestoreFileWithRetry(restoreHandle);
      const summary = await importArchiveBackupZip(restoreFile, (progress) => {
        setRestoreProgress(progress);
      });
      await onArchiveChanged();

      setRestoreTone("success");
      setRestoreStatus(
        isJapanese
          ? `アーカイブを復元しました: ${formatBackupSummary(summary, language)}`
          : `Archive restored: ${formatBackupSummary(summary, language)}`
      );
      setRestoreHandle(null);
      setRestoreFileName(null);
    } catch (error) {
      logger.error("archive.backup.restore.failed", {
        message: "Failed to restore archive backup.",
        context: {
          fileName: restoreFileName,
          error
        }
      });

      setRestoreTone("error");
      setRestoreStatus(getErrorMessage(error, isJapanese ? "復元に失敗しました。" : "Restore failed."));
    } finally {
      setRestoreProgress(null);
      setRestoreRunning(false);
    }
  }

  async function handleSelectRestoreFile() {
    try {
      const handle = await handleOpenFilePicker();

      if (handle === null) {
        return;
      }

      const file = await readRestoreFileWithRetry(handle);
      setRestoreHandle(handle);
      setRestoreFileName(file.name);
      setRestoreTone("neutral");
      setRestoreStatus(null);
    } catch (error) {
      logger.error("archive.backup.restore.select_failed", {
        message: "Failed to select restore backup file.",
        context: {
          error
        }
      });

      setRestoreTone("error");
      setRestoreStatus(
        getErrorMessage(error, isJapanese ? "バックアップ ZIP の選択に失敗しました。" : "Backup ZIP selection failed.")
      );
    }
  }

  async function handleDeleteAll() {
    setDeleteRunning(true);
    setDeleteStatus(null);
    setDeleteTone("neutral");

    try {
      await resetExtensionState();
      await onArchiveChanged();
      setDeleteConfirmStep(0);
      setDeleteTone("success");
      setDeleteStatus(
        isJapanese
          ? "拡張機能を初期化しました。ページを再読み込みして既定状態に戻します。"
          : "The extension was reset. Reloading the page to return to the default state."
      );
      window.setTimeout(() => {
        window.location.reload();
      }, 400);
    } catch (error) {
      logger.error("archive.reset.failed", {
        message: "Failed to reset extension state.",
        context: {
          error
        }
      });

      setDeleteTone("error");
      setDeleteStatus(
        getErrorMessage(error, isJapanese ? "初期化に失敗しました。" : "Reset failed.")
      );
    } finally {
      setDeleteRunning(false);
    }
  }

  return (
    <>
      <section className="viewer-settings-card">
        <div className="viewer-settings-card-header">
          <h3>Backup archive</h3>
          <p>
            {isJapanese
              ? "保存済みの投稿、タグ、アーカイブ済みメディアを settings 画面から 1 つの ZIP に書き出します。"
              : "Export saved posts, tags, and archived media files as a single ZIP backup from the settings screen."}
          </p>
        </div>
        <div className="viewer-settings-action-row">
          <button
            className="viewer-action-button"
            type="button"
            onClick={() => {
              void handleBackup();
            }}
            disabled={backupRunning || !hasArchive}
          >
            {backupRunning
              ? isJapanese
                ? "書き出し中..."
                : "Exporting..."
              : isJapanese
                ? "バックアップ ZIP を保存"
                : "Download backup ZIP"}
          </button>
        </div>
        {!hasArchive && (
          <p className="viewer-message">
            {isJapanese
              ? "まだ書き出せる保存済みアーカイブデータはありません。"
              : "No saved archive data is available to export yet."}
          </p>
        )}
        {backupRunning && backupProgress !== null && (
          <ProgressMessage progress={backupProgress} />
        )}
        {backupStatus !== null && <p className={feedbackClassName(backupTone)}>{backupStatus}</p>}
      </section>

      <section className="viewer-settings-card">
        <div className="viewer-settings-card-header">
          <h3>{isJapanese ? "アーカイブ復元" : "Restore archive"}</h3>
          <p>
            {isJapanese
              ? "バックアップ ZIP から復元します。現在の保存済みアーカイブはマージではなく置き換えになります。"
              : "Restore from a backup ZIP file. The current saved archive will be replaced instead of merged."}
          </p>
        </div>
        <div className="viewer-settings-file-row">
          <button
            className="viewer-secondary-button"
            type="button"
            disabled={restoreRunning}
            onClick={() => {
              void handleSelectRestoreFile();
            }}
          >
            {isJapanese ? "バックアップ ZIP を選択" : "Select backup ZIP"}
          </button>
          <button
            className="viewer-action-button"
            type="button"
            onClick={() => {
              void handleRestore();
            }}
            disabled={restoreRunning || restoreHandle === null}
          >
            {restoreRunning
              ? isJapanese
                ? "復元中..."
                : "Restoring..."
              : isJapanese
                ? "バックアップ ZIP から復元"
                : "Restore from backup ZIP"}
          </button>
        </div>
        <p className="viewer-settings-inline-note">
          {restoreFileName === null
            ? isJapanese
              ? "ファイル未選択です。"
              : "No file selected."
            : isJapanese
              ? `選択中: ${restoreFileName}`
              : `Selected: ${restoreFileName}`}
        </p>
        {restoreRunning && restoreProgress !== null && (
          <ProgressMessage progress={restoreProgress} />
        )}
        {restoreStatus !== null && (
          <p className={feedbackClassName(restoreTone)}>{restoreStatus}</p>
        )}
      </section>

      <section className="viewer-settings-card viewer-settings-card-danger">
        <div className="viewer-settings-card-header">
          <h3>{isJapanese ? "保存済みアーカイブ削除" : "Delete saved archive"}</h3>
          <p>
            {isJapanese
              ? "この拡張に保存されている投稿、タグ、アーカイブ済みメディアを完全に削除します。"
              : "Permanently remove saved posts, tags, and archived media files from this extension."}
          </p>
        </div>
        <p className="viewer-settings-inline-note">
          {isJapanese ? "現在のアーカイブ" : "Current archive"}: {deleteSummary}
        </p>
        <p className="viewer-settings-inline-note">
          {isJapanese
            ? "この操作ではアーカイブ本体に加えて、ログと閲覧設定も初期化します。"
            : "This action also resets logs and viewer settings."}
        </p>
        {deleteConfirmStep === 0 && (
          <div className="viewer-settings-action-row">
            <button
              className="viewer-danger-button"
              type="button"
              disabled={deleteRunning}
              onClick={() => {
                setDeleteTone("warning");
                setDeleteStatus(
                  isJapanese
                    ? "警告 1/2: 現在のブラウザープロファイルにある保存済みアーカイブデータを削除します。"
                    : "Warning 1/2: this resets archive data, logs, and settings in the current browser profile."
                );
                setDeleteConfirmStep(1);
              }}
            >
              {isJapanese ? "削除を開始" : "Start full delete"}
            </button>
          </div>
        )}
        {deleteConfirmStep >= 1 && deleteStatus !== null && (
          <p className={feedbackClassName(deleteTone)}>{deleteStatus}</p>
        )}
        {deleteConfirmStep === 1 && (
          <div className="viewer-settings-action-row">
            <button
              className="viewer-danger-button"
              type="button"
              disabled={deleteRunning}
              onClick={() => {
                setDeleteTone("warning");
                setDeleteStatus(
                  isJapanese
                    ? "警告 2/2: バックアップから復元しない限り、この操作は元に戻せません。"
                    : "Warning 2/2: this action cannot be undone unless you restore from backup."
                );
                setDeleteConfirmStep(2);
              }}
            >
              {isJapanese ? "削除を続行" : "Continue delete"}
            </button>
            <button
              className="viewer-secondary-button"
              type="button"
              disabled={deleteRunning}
              onClick={() => {
                setDeleteConfirmStep(0);
                setDeleteStatus(null);
                setDeleteTone("neutral");
              }}
            >
              {isJapanese ? "キャンセル" : "Cancel"}
            </button>
          </div>
        )}
        {deleteConfirmStep === 2 && (
          <div className="viewer-settings-action-row">
            <button
              className="viewer-danger-button"
              type="button"
              disabled={deleteRunning}
              onClick={() => {
                void handleDeleteAll();
              }}
            >
              {deleteRunning
                ? isJapanese
                  ? "削除中..."
                  : "Resetting..."
                : isJapanese
                  ? "今すぐすべて削除"
                  : "Reset extension now"}
            </button>
            <button
              className="viewer-secondary-button"
              type="button"
              disabled={deleteRunning}
              onClick={() => {
                setDeleteConfirmStep(0);
                setDeleteStatus(null);
                setDeleteTone("neutral");
              }}
            >
              {isJapanese ? "キャンセル" : "Cancel"}
            </button>
          </div>
        )}
        {!hasArchive && deleteConfirmStep === 0 && (
          <p className="viewer-message">
            {isJapanese
              ? "現在保存されているアーカイブデータはありません。"
              : "You can still reset logs and settings even when no archive data is stored."}
          </p>
        )}
      </section>
    </>
  );
}

function feedbackClassName(tone: FeedbackTone): string {
  if (tone === "error") {
    return "viewer-message viewer-message-error";
  }

  if (tone === "warning") {
    return "viewer-message viewer-message-warning";
  }

  if (tone === "success") {
    return "viewer-message viewer-message-success";
  }

  return "viewer-message";
}

function formatBackupSummary(summary: ArchiveBackupSummary, language: ArchiveLanguage): string {
  return [
    `${formatCount(summary.postCount, language)} ${language === "ja" ? "投稿" : "posts"}`,
    `${formatCount(summary.mediaCount, language)} ${language === "ja" ? "メディア" : "media"}`,
    `${formatCount(summary.tagCount, language)} ${language === "ja" ? "タグ" : "tags"}`,
    `${formatCount(summary.fileCount, language)} ${language === "ja" ? "ファイル" : "files"}`
  ].join(", ");
}

function formatCount(value: number, language: ArchiveLanguage): string {
  return new Intl.NumberFormat(language === "ja" ? "ja-JP" : "en-US").format(value);
}

function ProgressMessage({ progress }: { progress: ArchiveTransferProgress }) {
  const percent = formatProgressPercent(progress);

  return (
    <div className="viewer-progress-card" role="status" aria-live="polite">
      <div className="viewer-progress-header">
        <strong>{progress.phase}</strong>
        <span>{percent}%</span>
      </div>
      <div
        className="viewer-progress-bar"
        aria-hidden="true"
      >
        <span
          className="viewer-progress-bar-fill"
          style={{
            width: `${Math.max(0, Math.min(100, percent))}%`
          }}
        />
      </div>
      <p className="viewer-settings-inline-note">
        {progress.detail ?? `${progress.completed}/${progress.total}`}
      </p>
    </div>
  );
}

function formatProgressPercent(progress: ArchiveTransferProgress): number {
  if (progress.total <= 0) {
    return 0;
  }

  return Math.round((progress.completed / progress.total) * 100);
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() !== "" ? error.message : fallback;
}

async function handleOpenFilePicker(): Promise<FileSystemFileHandle | null> {
  if (typeof window.showOpenFilePicker !== "function") {
    throw new Error("Backup restore file selection is not supported in this environment.");
  }

  const handles = await window.showOpenFilePicker({
    multiple: false,
    types: [
      {
        description: "ZIP archive",
        accept: {
          "application/zip": [".zip"]
        }
      }
    ]
  });

  const handle = handles[0];
  return handle ?? null;
}

async function getBackupSaveFileHandle(): Promise<FileSystemFileHandle> {
  if (typeof window.showSaveFilePicker !== "function") {
    throw new Error("Streaming backup is not supported in this environment.");
  }

  return window.showSaveFilePicker({
    suggestedName: createBackupFilename(Date.now()),
    types: [
      {
        description: "ZIP archive",
        accept: {
          "application/zip": [".zip"]
        }
      }
    ]
  });
}

function createBackupFilename(timestamp: number): string {
  const iso = new Date(timestamp).toISOString().replaceAll(":", "-");
  return `x-post-archive-backup-${iso}.zip`;
}

async function readRestoreFileWithRetry(handle: FileSystemFileHandle): Promise<File> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await handle.getFile();
    } catch (error) {
      lastError = error;
      await wait(250 * (attempt + 1));
    }
  }

  throw new Error(
    "The selected backup ZIP could not be read. It may be locked or unavailable. Wait a moment and try again."
  );
}

function wait(durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, durationMs);
  });
}
