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

const UNITS = ["B", "KB", "MB", "GB", "TB"] as const;

export function formatBytesHumanReadable(byteSize: number): string {
  if (!Number.isFinite(byteSize) || byteSize < 0) {
    return `${byteSize} B`;
  }

  let value = byteSize;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < UNITS.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const rounded = unitIndex === 0 ? value.toString() : value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2);
  return `${rounded} ${UNITS[unitIndex]}`;
}
