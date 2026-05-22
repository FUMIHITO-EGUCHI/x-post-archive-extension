export const ARCHIVE_IMPORT_LIMITS = {
  maxEntryCount: 200_000,
  maxEntryUncompressedBytes: 2 * 1024 * 1024 * 1024,
  maxTotalUncompressedBytes: 50 * 1024 * 1024 * 1024,
  maxManifestUncompressedBytes: 256 * 1024 * 1024
} as const;

export type ArchiveImportLimits = typeof ARCHIVE_IMPORT_LIMITS;

export function exceedsArchiveImportEntryCount(count: number): boolean {
  return count > ARCHIVE_IMPORT_LIMITS.maxEntryCount;
}

export function exceedsArchiveImportEntrySize(byteSize: number): boolean {
  return byteSize > ARCHIVE_IMPORT_LIMITS.maxEntryUncompressedBytes;
}

export function exceedsArchiveImportTotalSize(totalByteSize: number): boolean {
  return totalByteSize > ARCHIVE_IMPORT_LIMITS.maxTotalUncompressedBytes;
}

export function exceedsArchiveImportManifestSize(byteSize: number): boolean {
  return byteSize > ARCHIVE_IMPORT_LIMITS.maxManifestUncompressedBytes;
}
