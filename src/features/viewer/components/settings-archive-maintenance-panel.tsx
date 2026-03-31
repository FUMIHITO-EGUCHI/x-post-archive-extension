import { useEffect, useMemo, useState } from "react";
import type { ArchiveBackupSummary } from "../../../types/archive-backup";
import {
  type ArchiveTransferProgress,
  clearArchiveData,
  importArchiveBackupZip
} from "../../archive/archive-maintenance-service";
import { streamArchiveBackupZip } from "../../archive/archive-maintenance-service";
import { createLogger } from "../../logging/logger";

type ArchiveMaintenancePanelProps = {
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
  const isTransferRunning = backupRunning || restoreRunning;
  const deleteSummary = useMemo(
    () =>
      `${formatCount(archiveSummary.postCount)} posts / ${formatCount(archiveSummary.mediaCount)} media / ${formatCount(archiveSummary.tagCount)} tags`,
    [archiveSummary.mediaCount, archiveSummary.postCount, archiveSummary.tagCount]
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
      setBackupStatus(`Backup exported: ${formatBackupSummary(backup.summary)}`);
    } catch (error) {
      logger.error("archive.backup.export.failed", {
        message: "Failed to export archive backup.",
        context: {
          error
        }
      });

      setBackupTone("error");
      setBackupStatus(getErrorMessage(error, "Backup export failed."));
    } finally {
      setBackupProgress(null);
      setBackupRunning(false);
    }
  }

  async function handleRestore() {
    if (restoreHandle === null) {
      setRestoreTone("warning");
      setRestoreStatus("Select a backup ZIP file first.");
      return;
    }

    const confirmed = window.confirm(
      "Restore will replace the current saved archive with the selected backup. Continue?"
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
      setRestoreStatus(`Archive restored: ${formatBackupSummary(summary)}`);
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
      setRestoreStatus(getErrorMessage(error, "Restore failed."));
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
      setRestoreStatus(getErrorMessage(error, "Backup ZIP selection failed."));
    }
  }

  async function handleDeleteAll() {
    setDeleteRunning(true);
    setDeleteStatus(null);
    setDeleteTone("neutral");

    try {
      await clearArchiveData();
      await onArchiveChanged();
      setDeleteConfirmStep(0);
      setDeleteTone("success");
      setDeleteStatus("Saved archive data was deleted.");
    } catch (error) {
      logger.error("archive.delete_all.failed", {
        message: "Failed to delete saved archive data.",
        context: {
          error
        }
      });

      setDeleteTone("error");
      setDeleteStatus(getErrorMessage(error, "Delete failed."));
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
            Export saved posts, tags, and archived media files as a single ZIP backup from the
            settings screen.
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
            {backupRunning ? "Exporting..." : "Download backup ZIP"}
          </button>
        </div>
        {!hasArchive && (
          <p className="viewer-message">No saved archive data is available to export yet.</p>
        )}
        {backupRunning && backupProgress !== null && (
          <ProgressMessage progress={backupProgress} />
        )}
        {backupStatus !== null && <p className={feedbackClassName(backupTone)}>{backupStatus}</p>}
      </section>

      <section className="viewer-settings-card">
        <div className="viewer-settings-card-header">
          <h3>Restore archive</h3>
          <p>
            Restore from a backup ZIP file. The current saved archive will be replaced instead of
            merged.
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
            Select backup ZIP
          </button>
          <button
            className="viewer-action-button"
            type="button"
            onClick={() => {
              void handleRestore();
            }}
            disabled={restoreRunning || restoreHandle === null}
          >
            {restoreRunning ? "Restoring..." : "Restore from backup ZIP"}
          </button>
        </div>
        <p className="viewer-settings-inline-note">
          {restoreFileName === null ? "No file selected." : `Selected: ${restoreFileName}`}
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
          <h3>Delete saved archive</h3>
          <p>
            Permanently remove saved posts, tags, and archived media files from this extension.
          </p>
        </div>
        <p className="viewer-settings-inline-note">Current archive: {deleteSummary}</p>
        {deleteConfirmStep === 0 && (
          <div className="viewer-settings-action-row">
            <button
              className="viewer-danger-button"
              type="button"
              disabled={deleteRunning || !hasArchive}
              onClick={() => {
                setDeleteTone("warning");
                setDeleteStatus(
                  "Warning 1/2: this deletes saved archive data from the current browser profile."
                );
                setDeleteConfirmStep(1);
              }}
            >
              Start full delete
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
                  "Warning 2/2: this action cannot be undone unless you restore from backup."
                );
                setDeleteConfirmStep(2);
              }}
            >
              Continue delete
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
              Cancel
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
              {deleteRunning ? "Deleting..." : "Delete everything now"}
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
              Cancel
            </button>
          </div>
        )}
        {!hasArchive && deleteConfirmStep === 0 && (
          <p className="viewer-message">No saved archive data is currently stored.</p>
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

function formatBackupSummary(summary: ArchiveBackupSummary): string {
  return [
    `${formatCount(summary.postCount)} posts`,
    `${formatCount(summary.mediaCount)} media`,
    `${formatCount(summary.tagCount)} tags`,
    `${formatCount(summary.fileCount)} files`
  ].join(", ");
}

function formatCount(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
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
