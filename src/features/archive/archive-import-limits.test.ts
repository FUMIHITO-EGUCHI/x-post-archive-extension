import { describe, expect, it } from "vitest";
import {
  ARCHIVE_IMPORT_LIMITS,
  exceedsArchiveImportEntryCount,
  exceedsArchiveImportEntrySize,
  exceedsArchiveImportManifestSize,
  exceedsArchiveImportTotalSize
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
