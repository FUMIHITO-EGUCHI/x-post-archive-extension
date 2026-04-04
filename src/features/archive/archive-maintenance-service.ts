import {
  BlobReader,
  BlobWriter,
  TextReader,
  TextWriter,
  ZipReader,
  ZipWriter,
  type Entry,
  type FileEntry
} from "@zip.js/zip.js";
import { archiveDb } from "../../db/archive-database";
import type {
  MediaRecord,
  PostRecord,
  PostTagRecord,
  TagRecord,
  TagRedirectRecord
} from "../../types/archive";
import type {
  ArchiveBackupManifest,
  ArchiveBackupFileEntry,
  ArchiveBackupSummary
} from "../../types/archive-backup";
import {
  clearMediaRootFromOpfs,
  readBlobFromOpfs,
  writeBlobToOpfs
} from "../media-storage/opfs-media-storage";

const ARCHIVE_BACKUP_FORMAT = "x-post-archive-backup";
const ARCHIVE_BACKUP_VERSION = 2;
const MEDIA_ROOT_PREFIX = "/media/";
const BACKUP_MANIFEST_FILE_NAME = "manifest.json";

export type ArchiveTransferProgress = {
  phase: string;
  completed: number;
  total: number;
  detail: string | null;
};

export async function streamArchiveBackupZip(
  writable: WritableStream,
  onProgress?: (progress: ArchiveTransferProgress) => void
): Promise<{
  summary: ArchiveBackupSummary;
}> {
  const [posts, media, tags, tagRedirects, postTags] = await Promise.all([
    archiveDb.posts.toArray(),
    archiveDb.media.toArray(),
    archiveDb.tags.toArray(),
    archiveDb.tag_redirects.toArray(),
    archiveDb.post_tags.toArray()
  ]);

  const filePaths = collectBackupFilePaths(media);
  const files: ArchiveBackupFileEntry[] = [];
  const zipWriter = new ZipWriter(writable, {
    zip64: true,
    level: 0,
    useWebWorkers: false
  });

  onProgress?.({
    phase: "Preparing backup",
    completed: 0,
    total: Math.max(filePaths.length, 1),
    detail: filePaths.length === 0 ? "No media files to archive." : "Scanning archived media files."
  });

  for (const [index, path] of filePaths.entries()) {
    const blob = await readBlobFromOpfs(path);
    files.push({
      path,
      mime_type: blob.type.trim() === "" ? null : blob.type,
      byte_size: blob.size
    });
    await zipWriter.add(toZipEntryPath(path), new BlobReader(blob), {
      level: 0,
      zip64: true,
      useWebWorkers: false
    });

    onProgress?.({
      phase: "Writing ZIP entries",
      completed: index + 1,
      total: filePaths.length,
      detail: path
    });
  }

  const manifest: ArchiveBackupManifest = {
    format: ARCHIVE_BACKUP_FORMAT,
    version: ARCHIVE_BACKUP_VERSION,
    exported_at: Date.now(),
    data: {
      posts,
      media,
      tags,
      tag_redirects: tagRedirects,
      post_tags: postTags,
      files
    }
  };

  onProgress?.({
    phase: "Writing manifest",
    completed: 0,
    total: 1,
    detail: "Writing manifest.json."
  });

  await zipWriter
    .add(BACKUP_MANIFEST_FILE_NAME, new TextReader(JSON.stringify(manifest, null, 2)), {
      level: 6,
      useWebWorkers: false
    })
    .catch((error: unknown) => {
      throw normalizeArchiveTransferError(error, "backup");
    });

  onProgress?.({
    phase: "Finalizing ZIP",
    completed: 0,
    total: 1,
    detail: "Writing ZIP directory."
  });

  await zipWriter.close().catch((error: unknown) => {
    throw normalizeArchiveTransferError(error, "backup");
  });

  onProgress?.({
    phase: "Backup ready",
    completed: 1,
    total: 1,
    detail: "Backup ZIP was written successfully."
  });

  return {
    summary: summarizeBackup(manifest)
  };
}

export async function importArchiveBackupZip(
  file: Blob,
  onProgress?: (progress: ArchiveTransferProgress) => void
): Promise<ArchiveBackupSummary> {
  const zipReader = new ZipReader(new BlobReader(file), {
    useWebWorkers: false
  });

  try {
    onProgress?.({
      phase: "Opening ZIP",
      completed: 0,
      total: 1,
      detail: "Scanning backup ZIP."
    });

    const entries = await zipReader.getEntries();
    const fileEntries = createFileEntryMap(entries);
    const manifestEntry = fileEntries.get(BACKUP_MANIFEST_FILE_NAME);

    if (manifestEntry === undefined) {
      throw new Error("Backup ZIP does not contain manifest.json.");
    }

    const manifestText = await manifestEntry
      .getData(new TextWriter(), {
        useWebWorkers: false
      })
      .catch((error: unknown) => {
        throw normalizeArchiveTransferError(error, "restore");
      });
    const backup = parseArchiveBackupManifest(JSON.parse(manifestText) as unknown);

    onProgress?.({
      phase: "Validating backup",
      completed: 1,
      total: 1,
      detail: "Checking manifest and ZIP entries."
    });

    validateRequiredBackupFiles(backup.data.media, fileEntries);

    onProgress?.({
      phase: "Clearing current archive",
      completed: 0,
      total: 1,
      detail: "Removing current saved archive data."
    });

    await clearArchiveData();

    onProgress?.({
      phase: "Restoring files",
      completed: 0,
      total: Math.max(backup.data.files.length, 1),
      detail:
        backup.data.files.length === 0 ? "No archived media files to restore." : "Writing archived media files."
    });

    for (const [index, fileEntry] of backup.data.files.entries()) {
      const zipEntry = fileEntries.get(toZipEntryPath(fileEntry.path));

      if (zipEntry === undefined) {
        throw new Error(`Backup ZIP is missing ${toZipEntryPath(fileEntry.path)}.`);
      }

      const blob = await zipEntry
        .getData(new BlobWriter(fileEntry.mime_type ?? "application/octet-stream"), {
          useWebWorkers: false
        })
        .catch((error: unknown) => {
          throw normalizeArchiveTransferError(error, "restore");
        });
      await writeBlobToOpfs(fileEntry.path, blob);

      onProgress?.({
        phase: "Restoring files",
        completed: index + 1,
        total: backup.data.files.length,
        detail: fileEntry.path
      });
    }

    onProgress?.({
      phase: "Restoring database",
      completed: 0,
      total: 5,
      detail: "Writing archive records."
    });

    await archiveDb.transaction(
      "rw",
      [
        archiveDb.posts,
        archiveDb.media,
        archiveDb.tags,
        archiveDb.tag_redirects,
        archiveDb.post_tags
      ],
      async () => {
        await archiveDb.posts.bulkPut(backup.data.posts);
        onProgress?.({
          phase: "Restoring database",
          completed: 1,
          total: 5,
          detail: "Posts restored."
        });
        await archiveDb.media.bulkPut(backup.data.media);
        onProgress?.({
          phase: "Restoring database",
          completed: 2,
          total: 5,
          detail: "Media restored."
        });
        await archiveDb.tags.bulkPut(backup.data.tags);
        onProgress?.({
          phase: "Restoring database",
          completed: 3,
          total: 5,
          detail: "Tags restored."
        });
        await archiveDb.tag_redirects.bulkPut(backup.data.tag_redirects);
        onProgress?.({
          phase: "Restoring database",
          completed: 4,
          total: 5,
          detail: "Tag redirects restored."
        });
        await archiveDb.post_tags.bulkPut(backup.data.post_tags);
        onProgress?.({
          phase: "Restoring database",
          completed: 5,
          total: 5,
          detail: "Post tag relations restored."
        });
      }
    );

    onProgress?.({
      phase: "Restore complete",
      completed: 1,
      total: 1,
      detail: "Archive restore finished."
    });

    return summarizeBackup(backup);
  } catch (error) {
    throw normalizeArchiveTransferError(error, "restore");
  } finally {
    await zipReader.close();
  }
}

export async function clearArchiveData(): Promise<void> {
  await clearMediaRootFromOpfs();

  await archiveDb.transaction(
    "rw",
    [
      archiveDb.posts,
      archiveDb.media,
      archiveDb.tags,
      archiveDb.tag_redirects,
      archiveDb.post_tags
    ],
    async () => {
      await archiveDb.post_tags.clear();
      await archiveDb.tag_redirects.clear();
      await archiveDb.tags.clear();
      await archiveDb.media.clear();
      await archiveDb.posts.clear();
    }
  );
}

export async function resetExtensionState(): Promise<void> {
  await clearMediaRootFromOpfs();
  await archiveDb.logs.clear();

  await archiveDb.transaction(
    "rw",
    [
      archiveDb.posts,
      archiveDb.media,
      archiveDb.tags,
      archiveDb.tag_redirects,
      archiveDb.post_tags
    ],
    async () => {
      await archiveDb.post_tags.clear();
      await archiveDb.tag_redirects.clear();
      await archiveDb.tags.clear();
      await archiveDb.media.clear();
      await archiveDb.posts.clear();
    }
  );

  await browser.storage.local.clear();
}

export function summarizeBackup(backup: ArchiveBackupManifest): ArchiveBackupSummary {
  return {
    postCount: backup.data.posts.length,
    mediaCount: backup.data.media.length,
    tagCount: backup.data.tags.length,
    tagRedirectCount: backup.data.tag_redirects.length,
    postTagCount: backup.data.post_tags.length,
    fileCount: backup.data.files.length
  };
}

function collectBackupFilePaths(media: MediaRecord[]): string[] {
  const paths = new Set<string>();

  for (const item of media) {
    if (item.storage_status === "ready") {
      paths.add(item.opfs_path);
    }

    if (item.preview_image_opfs_path !== null) {
      paths.add(item.preview_image_opfs_path);
    }
  }

  return [...paths.values()];
}

function createFileEntryMap(entries: Entry[]): Map<string, FileEntry> {
  const fileEntries = new Map<string, FileEntry>();

  for (const entry of entries) {
    if (!entry.directory) {
      fileEntries.set(entry.filename, entry);
    }
  }

  return fileEntries;
}

function validateRequiredBackupFiles(
  media: MediaRecord[],
  fileEntries: ReadonlyMap<string, FileEntry>
): void {
  for (const item of media) {
    if (item.storage_status === "ready" && !fileEntries.has(toZipEntryPath(item.opfs_path))) {
      throw new Error(`Backup is missing a media file for ${item.media_id}.`);
    }

    if (
      item.preview_image_opfs_path !== null &&
      !fileEntries.has(toZipEntryPath(item.preview_image_opfs_path))
    ) {
      throw new Error(`Backup is missing a preview file for ${item.media_id}.`);
    }
  }
}

function parseArchiveBackupManifest(value: unknown): ArchiveBackupManifest {
  if (!isRecord(value)) {
    throw new Error("Backup manifest must be an object.");
  }

  if (value.format !== ARCHIVE_BACKUP_FORMAT) {
    throw new Error("Backup manifest format is not supported.");
  }

  if (value.version !== 1 && value.version !== ARCHIVE_BACKUP_VERSION) {
    throw new Error("Backup manifest version is not supported.");
  }

  if (!isFiniteNumber(value.exported_at)) {
    throw new Error("Backup manifest exported_at is invalid.");
  }

  if (!isRecord(value.data)) {
    throw new Error("Backup manifest data is invalid.");
  }

  return {
    format: ARCHIVE_BACKUP_FORMAT,
    version: value.version,
    exported_at: value.exported_at,
    data: {
      posts: parseArray(value.data.posts, parsePostRecord),
      media: parseArray(value.data.media, parseMediaRecord),
      tags: parseArray(value.data.tags, parseTagRecord),
      tag_redirects:
        value.version === 1
          ? []
          : parseArray(value.data.tag_redirects, parseTagRedirectRecord),
      post_tags: parseArray(value.data.post_tags, parsePostTagRecord),
      files: parseArray(value.data.files, parseBackupFileEntry)
    }
  };
}

function parseArray<T>(value: unknown, parseItem: (item: unknown) => T): T[] {
  if (!Array.isArray(value)) {
    throw new Error("Backup manifest array value is invalid.");
  }

  return value.map((item) => parseItem(item));
}

function parsePostRecord(value: unknown): PostRecord {
  if (!isRecord(value)) {
    throw new Error("Post record is invalid.");
  }

  return {
    x_post_id: requireString(value.x_post_id, "post.x_post_id"),
    display_name: requireString(value.display_name, "post.display_name"),
    x_username: requireString(value.x_username, "post.x_username"),
    post_text: requireString(value.post_text, "post.post_text"),
    post_url: requireString(value.post_url, "post.post_url"),
    posted_at: requireFiniteNumberValue(value.posted_at, "post.posted_at"),
    reply_count: requireFiniteNumberValue(value.reply_count, "post.reply_count"),
    repost_count: requireFiniteNumberValue(value.repost_count, "post.repost_count"),
    like_count: requireFiniteNumberValue(value.like_count, "post.like_count"),
    saved_at: requireFiniteNumberValue(value.saved_at, "post.saved_at")
  };
}

function parseMediaRecord(value: unknown): MediaRecord {
  if (!isRecord(value)) {
    throw new Error("Media record is invalid.");
  }

  const mediaType = requireUnion(value.media_type, ["image", "video"], "media.media_type");
  const storageStatus = requireUnion(
    value.storage_status,
    ["pending", "ready", "failed"],
    "media.storage_status"
  );

  return {
    media_id: requireString(value.media_id, "media.media_id"),
    x_post_id: requireString(value.x_post_id, "media.x_post_id"),
    media_type: mediaType,
    source_url: requireString(value.source_url, "media.source_url"),
    preview_image_url: requireNullableString(value.preview_image_url, "media.preview_image_url"),
    preview_image_opfs_path: requireNullableBackupPath(
      value.preview_image_opfs_path,
      "media.preview_image_opfs_path"
    ),
    opfs_path: requireBackupPath(value.opfs_path, "media.opfs_path"),
    position: requireFiniteNumberValue(value.position, "media.position"),
    alt_text: requireNullableString(value.alt_text, "media.alt_text"),
    width: requireNullableFiniteNumberValue(value.width, "media.width"),
    height: requireNullableFiniteNumberValue(value.height, "media.height"),
    mime_type: requireNullableString(value.mime_type, "media.mime_type"),
    byte_size: requireNullableFiniteNumberValue(value.byte_size, "media.byte_size"),
    storage_status: storageStatus,
    saved_at: requireFiniteNumberValue(value.saved_at, "media.saved_at"),
    last_error: requireNullableString(value.last_error, "media.last_error")
  };
}

function parseTagRecord(value: unknown): TagRecord {
  if (!isRecord(value)) {
    throw new Error("Tag record is invalid.");
  }

  return {
    tag_id: requireString(value.tag_id, "tag.tag_id"),
    normalized_name: requireString(value.normalized_name, "tag.normalized_name"),
    display_name: requireString(value.display_name, "tag.display_name"),
    system_key: requireNullableBuiltInTagKey(value.system_key, "tag.system_key"),
    created_at: requireFiniteNumberValue(value.created_at, "tag.created_at")
  };
}

function parsePostTagRecord(value: unknown): PostTagRecord {
  if (!isRecord(value)) {
    throw new Error("Post tag record is invalid.");
  }

  const source = requireUnion(value.source, ["auto", "manual"], "post_tag.source");

  return {
    post_tag_id: requireString(value.post_tag_id, "post_tag.post_tag_id"),
    x_post_id: requireString(value.x_post_id, "post_tag.x_post_id"),
    tag_id: requireString(value.tag_id, "post_tag.tag_id"),
    normalized_name: requireString(value.normalized_name, "post_tag.normalized_name"),
    display_name: requireString(value.display_name, "post_tag.display_name"),
    system_key: requireNullableBuiltInTagKey(value.system_key, "post_tag.system_key"),
    source,
    assigned_at: requireFiniteNumberValue(value.assigned_at, "post_tag.assigned_at")
  };
}

function parseTagRedirectRecord(value: unknown): TagRedirectRecord {
  if (!isRecord(value)) {
    throw new Error("Tag redirect record is invalid.");
  }

  return {
    tag_redirect_id: requireString(value.tag_redirect_id, "tag_redirect.tag_redirect_id"),
    source_normalized_name: requireString(
      value.source_normalized_name,
      "tag_redirect.source_normalized_name"
    ),
    source_display_name: requireString(
      value.source_display_name,
      "tag_redirect.source_display_name"
    ),
    target_tag_id: requireString(value.target_tag_id, "tag_redirect.target_tag_id"),
    created_at: requireFiniteNumberValue(value.created_at, "tag_redirect.created_at")
  };
}

function parseBackupFileEntry(value: unknown): ArchiveBackupFileEntry {
  if (!isRecord(value)) {
    throw new Error("Backup file entry is invalid.");
  }

  return {
    path: requireBackupPath(value.path, "file.path"),
    mime_type: requireNullableString(value.mime_type, "file.mime_type"),
    byte_size: requireFiniteNumberValue(value.byte_size, "file.byte_size")
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new Error(`${field} is invalid.`);
  }

  return value;
}

function requireNullableString(value: unknown, field: string): string | null {
  if (value === null) {
    return null;
  }

  return requireString(value, field);
}

function requireNullableBuiltInTagKey(
  value: unknown,
  field: string
): "liked" | "image" | "video" | "quoted" | null {
  if (value === undefined || value === null) {
    return null;
  }

  return requireUnion(value, ["liked", "image", "video", "quoted"], field) as
    | "liked"
    | "image"
    | "video"
    | "quoted";
}

function requireFiniteNumberValue(value: unknown, field: string): number {
  if (!isFiniteNumber(value)) {
    throw new Error(`${field} is invalid.`);
  }

  return value;
}

function requireNullableFiniteNumberValue(value: unknown, field: string): number | null {
  if (value === null) {
    return null;
  }

  return requireFiniteNumberValue(value, field);
}

function requireUnion<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string
): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new Error(`${field} is invalid.`);
  }

  return value as T;
}

function requireBackupPath(value: unknown, field: string): string {
  const path = requireString(value, field);

  if (!path.startsWith(MEDIA_ROOT_PREFIX)) {
    throw new Error(`${field} must be under ${MEDIA_ROOT_PREFIX}.`);
  }

  return path;
}

function requireNullableBackupPath(value: unknown, field: string): string | null {
  if (value === null) {
    return null;
  }

  return requireBackupPath(value, field);
}

function toZipEntryPath(opfsPath: string): string {
  return opfsPath.startsWith("/") ? opfsPath.slice(1) : opfsPath;
}

function createBackupFilename(timestamp: number): string {
  const iso = new Date(timestamp).toISOString().replaceAll(":", "-");
  return `x-post-archive-backup-${iso}.zip`;
}

function normalizeArchiveTransferError(
  error: unknown,
  operation: "backup" | "restore"
): Error {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (
      message.includes("array buffer allocation failed") ||
      message.includes("out of memory") ||
      message.includes("invalid array length")
    ) {
      return new Error(
        operation === "backup"
          ? "Backup failed because the archive is too large to assemble as one ZIP in memory."
          : "Restore failed because the backup ZIP or one of its entries is too large to process safely."
      );
    }

    return error;
  }

  return new Error(
    operation === "backup" ? "Backup failed." : "Restore failed."
  );
}
