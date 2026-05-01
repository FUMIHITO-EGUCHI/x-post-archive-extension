import { useEffect, useMemo, useState } from "react";
import type { ArchiveBackupSummary } from "../../../types/archive-backup";
import type { RefetchStatusRecord } from "../../../types/refetch";
import {
  type ArchiveTransferProgress,
  type RestoreMode,
  importArchiveBackupZip,
  streamArchiveBackupZip
} from "../../archive/archive-maintenance-service";
import { requestResetArchive } from "../../runtime/client";
import { createLogger } from "../../logging/logger";
import type { ArchiveLanguage } from "../../settings/archive-language";

type ArchiveMaintenancePanelProps = {
  language: ArchiveLanguage;
  archiveSummary: {
    postCount: number;
    mediaCount: number;
    tagCount: number;
  };
  refetchStatus: RefetchStatusRecord;
  onRefetchAll: () => Promise<void>;
  onRefetchZeroEngagement: () => Promise<void>;
  onRefetchCancel: () => Promise<void>;
  onRefetchClear: () => Promise<void>;
  onArchiveChanged: () => Promise<void>;
};

type FeedbackTone = "neutral" | "success" | "error" | "warning";

const logger = createLogger("viewer-settings-archive");

export function SettingsArchiveMaintenancePanel({
  language,
  archiveSummary,
  refetchStatus,
  onRefetchAll,
  onRefetchZeroEngagement,
  onRefetchCancel,
  onRefetchClear,
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
  const [restoreMode, setRestoreMode] = useState<RestoreMode>("replace");
  const [backupProgress, setBackupProgress] = useState<ArchiveTransferProgress | null>(null);
  const [restoreProgress, setRestoreProgress] = useState<ArchiveTransferProgress | null>(null);
  const [deleteStatus, setDeleteStatus] = useState<string | null>(null);
  const [deleteTone, setDeleteTone] = useState<FeedbackTone>("neutral");
  const [deleteRunning, setDeleteRunning] = useState(false);
  const [deleteConfirmStep, setDeleteConfirmStep] = useState<0 | 1 | 2>(0);

  const hasArchive = archiveSummary.postCount > 0 || archiveSummary.mediaCount > 0;
  const isJapanese = language === "ja";
  const isTransferRunning = backupRunning || restoreRunning;
  const refetchProcessedCount = refetchStatus.completedCount + refetchStatus.failedCount;
  const refetchPercent =
    refetchStatus.totalCount === 0
      ? 0
      : Math.round((refetchProcessedCount / refetchStatus.totalCount) * 100);
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
      const fileHandle = await getBackupSaveFileHandle(language);
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

    const confirmed =
      restoreMode === "replace"
        ? window.confirm(
            isJapanese
              ? "復元すると、現在の保存済みアーカイブは選択したバックアップで置き換えられます。続行しますか？"
              : "Restore will replace the current saved archive with the selected backup. Continue?"
          )
        : true;

    if (!confirmed) {
      return;
    }

    setRestoreRunning(true);
    setRestoreStatus(null);
    setRestoreTone("neutral");
    setRestoreProgress(null);

    try {
      const restoreFile = await readRestoreFileWithRetry(restoreHandle, language);
      const summary = await importArchiveBackupZip(restoreFile, {
        mode: restoreMode,
        onProgress: (progress) => {
          setRestoreProgress(progress);
        }
      });
      await onArchiveChanged();

      setRestoreTone("success");
      setRestoreStatus(
        isJapanese
          ? restoreMode === "replace"
            ? `アーカイブを復元しました: ${formatBackupSummary(summary, language)}`
            : `バックアップをマージしました: ${formatBackupSummary(summary, language)}`
          : restoreMode === "replace"
            ? `Archive restored: ${formatBackupSummary(summary, language)}`
            : `Backup merged: ${formatBackupSummary(summary, language)}`
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
      const handle = await handleOpenFilePicker(language);

      if (handle === null) {
        return;
      }

      const file = await readRestoreFileWithRetry(handle, language);
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
      await requestResetArchive();
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
          <h3>{isJapanese ? "投稿の再取得" : "Refetch saved posts"}</h3>
          <p>
            {isJapanese
              ? "保存済み投稿を X.com から再取得して、本文・表示名・反応数・メディア情報を更新します。"
              : "Re-open saved posts on X.com and refresh text, display name, engagement, and media metadata."}
          </p>
        </div>
        <div className="viewer-settings-action-row">
          <button
            className="viewer-action-button"
            type="button"
            onClick={() => {
              void onRefetchAll();
            }}
            disabled={archiveSummary.postCount === 0}
          >
            {isJapanese ? "保存済み投稿を一括再取得" : "Refetch all saved posts"}
          </button>
          <button
            className="viewer-secondary-button"
            type="button"
            onClick={() => {
              void onRefetchZeroEngagement();
            }}
            disabled={archiveSummary.postCount === 0}
          >
            {isJapanese ? "反応数 0 の投稿だけ再取得" : "Refetch posts with 0 engagement"}
          </button>
          <button
            className="viewer-secondary-button"
            type="button"
            onClick={() => {
              void onRefetchCancel();
            }}
            disabled={refetchStatus.phase !== "running"}
          >
            {isJapanese ? "現在の件で停止" : "Stop after current post"}
          </button>
          <button
            className="viewer-secondary-button"
            type="button"
            onClick={() => {
              void onRefetchClear();
            }}
            disabled={refetchStatus.phase === "running" || refetchStatus.totalCount === 0}
          >
            {isJapanese ? "キューをクリア" : "Clear queue"}
          </button>
        </div>
        {refetchStatus.totalCount === 0 ? (
          <p className="viewer-message">
            {isJapanese ? "再取得キューは空です。" : "The refetch queue is empty."}
          </p>
        ) : (
          <div className="viewer-progress-card" role="status" aria-live="polite">
            <div className="viewer-progress-header">
              <strong>{formatRefetchPhaseLabel(refetchStatus, language)}</strong>
              <span>{refetchPercent}%</span>
            </div>
            <div className="viewer-progress-bar" aria-hidden="true">
              <span
                className="viewer-progress-bar-fill"
                style={{
                  width: `${Math.max(0, Math.min(100, refetchPercent))}%`
                }}
              />
            </div>
            <p className="viewer-settings-inline-note">
              {formatRefetchCounts(refetchStatus, language)}
            </p>
            {refetchStatus.currentPostId !== null && (
              <p className="viewer-settings-inline-note">
                {isJapanese
                  ? `処理中: ${refetchStatus.currentPostId}`
                  : `Current: ${refetchStatus.currentPostId}`}
              </p>
            )}
            {refetchStatus.estimatedRemainingMs !== null && (
              <p className="viewer-settings-inline-note">
                {isJapanese
                  ? `残り目安: ${formatDurationLabel(refetchStatus.estimatedRemainingMs, language)}`
                  : `Estimated remaining: ${formatDurationLabel(refetchStatus.estimatedRemainingMs, language)}`}
              </p>
            )}
          </div>
        )}
      </section>

      <section className="viewer-settings-card">
        <div className="viewer-settings-card-header">
          <h3>{isJapanese ? "バックアップを書き出す" : "Export backup"}</h3>
          <p>
            {isJapanese
              ? "今のアーカイブを 1 つの ZIP にまとめて保存します。別の端末への移行や手元保管に使えます。"
              : "Save your current archive as one ZIP file for safekeeping or moving to another device."}
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
              ? "まだバックアップできる保存データはありません。"
              : "There is no saved archive data to back up yet."}
          </p>
        )}
        {backupRunning && backupProgress !== null && (
          <ProgressMessage progress={backupProgress} />
        )}
        {backupStatus !== null && <p className={feedbackClassName(backupTone)}>{backupStatus}</p>}
      </section>

      <section className="viewer-settings-card">
        <div className="viewer-settings-card-header">
          <h3>{isJapanese ? "バックアップから復元" : "Restore from backup"}</h3>
          <p>
            {isJapanese
              ? "バックアップ ZIP の内容を復元します。現在のアーカイブを置き換えるか、既存データに追加するかを選べます。"
              : "Restore a backup ZIP by replacing the current archive or merging it into existing data."}
          </p>
        </div>
        <div className="viewer-font-option-list" role="radiogroup" aria-label={isJapanese ? "復元モード" : "Restore mode"}>
          {[
            {
              value: "replace" as const,
              label: isJapanese
                ? "置き換え: 現在のアーカイブを削除して復元"
                : "Replace: clear current archive and restore"
            },
            {
              value: "merge" as const,
              label: isJapanese
                ? "マージ: 既存データに追加"
                : "Merge: add to existing archive"
            }
          ].map((option) => (
            <button
              key={option.value}
              className={
                restoreMode === option.value
                  ? "viewer-font-option viewer-font-option-active"
                  : "viewer-font-option"
              }
              type="button"
              role="radio"
              aria-checked={restoreMode === option.value}
              disabled={restoreRunning}
              onClick={() => {
                setRestoreMode(option.value);
              }}
            >
              <strong>{option.label}</strong>
            </button>
          ))}
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
              ? "まだファイルが選択されていません。"
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
          <h3>{isJapanese ? "保存済みアーカイブを削除" : "Delete saved archive"}</h3>
          <p>
            {isJapanese
              ? "この拡張機能に保存されている投稿やメディアをすべて削除します。元に戻せません。"
              : "Delete all posts, tags, and media saved in this extension. This cannot be undone."}
          </p>
        </div>
        <p className="viewer-settings-inline-note">
          {isJapanese ? "現在のアーカイブ" : "Current archive"}: {deleteSummary}
        </p>
        <p className="viewer-settings-inline-note">
          {isJapanese
            ? "ログと表示設定もあわせて初期化されます。"
            : "Logs and viewer settings are cleared as well."}
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
    `${formatCount(summary.fileCount, language)} ${language === "ja" ? "ファイル" : "files"}`,
    `${formatBytes(summary.fileBytes, language)} ${language === "ja" ? "ファイル容量" : "file payload"}`
  ].join(", ");
}

function formatCount(value: number, language: ArchiveLanguage): string {
  return new Intl.NumberFormat(language === "ja" ? "ja-JP" : "en-US").format(value);
}

function formatBytes(value: number, language: ArchiveLanguage): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let currentValue = value;
  let unitIndex = 0;

  while (currentValue >= 1024 && unitIndex < units.length - 1) {
    currentValue /= 1024;
    unitIndex += 1;
  }

  const digits = currentValue >= 100 || unitIndex === 0 ? 0 : 1;
  return `${currentValue.toFixed(digits)} ${units[unitIndex]}`;
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

function formatRefetchPhaseLabel(
  refetchStatus: RefetchStatusRecord,
  language: ArchiveLanguage
): string {
  if (refetchStatus.phase === "running") {
    return language === "ja" ? "再取得を実行中" : "Refetch is running";
  }

  if (refetchStatus.phase === "stopped") {
    return language === "ja" ? "停止中" : "Stopped";
  }

  return language === "ja" ? "完了または待機中" : "Completed or idle";
}

function formatRefetchCounts(
  refetchStatus: RefetchStatusRecord,
  language: ArchiveLanguage
): string {
  return [
    language === "ja"
      ? `完了 ${formatCount(refetchStatus.completedCount, language)}`
      : `Done ${formatCount(refetchStatus.completedCount, language)}`,
    language === "ja"
      ? `失敗 ${formatCount(refetchStatus.failedCount, language)}`
      : `Failed ${formatCount(refetchStatus.failedCount, language)}`,
    language === "ja"
      ? `保留 ${formatCount(refetchStatus.pendingCount, language)}`
      : `Pending ${formatCount(refetchStatus.pendingCount, language)}`
  ].join(" / ");
}

function formatDurationLabel(valueMs: number, language: ArchiveLanguage): string {
  const roundedSeconds = Math.max(1, Math.round(valueMs / 1000));

  if (roundedSeconds < 60) {
    return language === "ja" ? `${roundedSeconds}秒` : `${roundedSeconds}s`;
  }

  const minutes = Math.floor(roundedSeconds / 60);
  const seconds = roundedSeconds % 60;

  if (seconds === 0) {
    return language === "ja" ? `${minutes}分` : `${minutes}m`;
  }

  return language === "ja" ? `${minutes}分${seconds}秒` : `${minutes}m ${seconds}s`;
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() !== "" ? error.message : fallback;
}

async function handleOpenFilePicker(language: ArchiveLanguage): Promise<FileSystemFileHandle | null> {
  if (typeof window.showOpenFilePicker !== "function") {
    throw new Error(
      language === "ja"
        ? "この環境ではバックアップ ZIP を選択できません。"
        : "Backup restore file selection is not supported in this environment."
    );
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

async function getBackupSaveFileHandle(language: ArchiveLanguage): Promise<FileSystemFileHandle> {
  if (typeof window.showSaveFilePicker !== "function") {
    throw new Error(
      language === "ja"
        ? "この環境ではストリーミングバックアップを書き出せません。"
        : "Streaming backup is not supported in this environment."
    );
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

async function readRestoreFileWithRetry(
  handle: FileSystemFileHandle,
  language: ArchiveLanguage
): Promise<File> {
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
    language === "ja"
      ? "選択したバックアップ ZIP を読み込めませんでした。ロックされているか、一時的に利用できない可能性があります。少し待って再試行してください。"
      : "The selected backup ZIP could not be read. It may be locked or unavailable. Wait a moment and try again."
  );
}

function wait(durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, durationMs);
  });
}
