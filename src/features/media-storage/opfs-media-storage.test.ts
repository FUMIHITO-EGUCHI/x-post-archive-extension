import { afterEach, expect, it, vi } from "vitest";
import { readBlobFromOpfs } from "./opfs-media-storage";

afterEach(() => vi.unstubAllGlobals());

it("restores MIME without altering bytes, and preserves legacy reads without MIME", async () => {
  const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], "image.bin", {
    type: "application/octet-stream"
  });
  const directory = {
    getDirectoryHandle: vi.fn(),
    getFileHandle: vi.fn().mockResolvedValue({ getFile: async () => file })
  };
  directory.getDirectoryHandle.mockResolvedValue(directory);
  vi.stubGlobal("navigator", {
    storage: { getDirectory: async () => directory }
  });
  const blob = await readBlobFromOpfs("/media/images/123/image.bin", "image/jpeg");
  expect(blob.type).toBe("image/jpeg");
  expect(await blob.arrayBuffer()).toEqual(await file.arrayBuffer());
  for (const mime of [undefined, null, ""]) {
    expect(await readBlobFromOpfs("/media/images/123/image.bin", mime)).toBe(file);
  }
});
