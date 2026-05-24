import { describe, expect, it } from "vitest";
import {
  ARCHIVE_IMPORT_LIMITS,
  exceedsArchiveImportEntryCount,
  exceedsArchiveImportEntrySize,
  exceedsArchiveImportManifestSize,
  exceedsArchiveImportTotalSize,
  formatBytesHumanReadable
} from "./archive-import-limits";

describe("archive import limits", () => {
  it("flags entry counts beyond the maximum", () => {
    expect(exceedsArchiveImportEntryCount(ARCHIVE_IMPORT_LIMITS.maxEntryCount)).toBe(false);
    expect(exceedsArchiveImportEntryCount(ARCHIVE_IMPORT_LIMITS.maxEntryCount + 1)).toBe(true);
  });

  it("flags single entries larger than the per-entry maximum", () => {
    expect(exceedsArchiveImportEntrySize(ARCHIVE_IMPORT_LIMITS.maxEntryUncompressedBytes)).toBe(false);
    expect(exceedsArchiveImportEntrySize(ARCHIVE_IMPORT_LIMITS.maxEntryUncompressedBytes + 1)).toBe(true);
  });

  it("flags total uncompressed size beyond the maximum", () => {
    expect(exceedsArchiveImportTotalSize(ARCHIVE_IMPORT_LIMITS.maxTotalUncompressedBytes)).toBe(false);
    expect(exceedsArchiveImportTotalSize(ARCHIVE_IMPORT_LIMITS.maxTotalUncompressedBytes + 1)).toBe(true);
  });

  it("flags manifest sizes beyond the manifest-specific maximum", () => {
    expect(exceedsArchiveImportManifestSize(ARCHIVE_IMPORT_LIMITS.maxManifestUncompressedBytes)).toBe(false);
    expect(
      exceedsArchiveImportManifestSize(ARCHIVE_IMPORT_LIMITS.maxManifestUncompressedBytes + 1)
    ).toBe(true);
  });
});

describe("formatBytesHumanReadable", () => {
  it("formats bytes in the appropriate unit", () => {
    expect(formatBytesHumanReadable(0)).toBe("0 B");
    expect(formatBytesHumanReadable(512)).toBe("512 B");
    expect(formatBytesHumanReadable(1024)).toBe("1.00 KB");
    expect(formatBytesHumanReadable(1024 * 1024)).toBe("1.00 MB");
    expect(formatBytesHumanReadable(2 * 1024 * 1024 * 1024)).toBe("2.00 GB");
    expect(formatBytesHumanReadable(50 * 1024 * 1024 * 1024)).toBe("50.0 GB");
    expect(formatBytesHumanReadable(256 * 1024 * 1024)).toBe("256 MB");
  });

  it("falls back gracefully for invalid input", () => {
    expect(formatBytesHumanReadable(Number.NaN)).toBe("NaN B");
    expect(formatBytesHumanReadable(-1)).toBe("-1 B");
  });
});
