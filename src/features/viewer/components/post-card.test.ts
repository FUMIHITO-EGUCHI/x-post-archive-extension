import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ArchivePostRecord, MediaRecord } from "../../../types/archive";
import { downloadPostMedia } from "../utils/media-download";
import { PostCard, type PostCardProps } from "./post-card";

vi.mock("../utils/media-download", () => ({ downloadPostMedia: vi.fn() }));
vi.mock("../../logging/logger", () => ({ createLogger: () => ({ error: vi.fn() }) }));

const media: MediaRecord = {
  media_id: "image", x_post_id: "123", media_type: "image", source_url: "https://example.com/a.jpg",
  preview_image_url: null, preview_image_opfs_path: null, opfs_path: "/media/images/123/image.bin",
  position: 0, alt_text: null, width: null, height: null, mime_type: "image/jpeg",
  byte_size: null, checksum: null, storage_status: "ready", saved_at: 0, last_error: null
};
const post: ArchivePostRecord = {
  x_post_id: "123", x_username: "author", display_name: "Author", post_text: "Text",
  post_url: "https://x.com/author/status/123", posted_at: 0, saved_at: 0,
  reply_count: 0, repost_count: 0, like_count: 0, media: [media], tags: []
};
let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("IntersectionObserver", class {
    observe() {}
    disconnect() {}
  });
  vi.mocked(downloadPostMedia).mockReset().mockResolvedValue({ failedCount: 0 });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

async function render(overrides: Partial<PostCardProps> = {}) {
  const props: PostCardProps = {
    post, language: "ja", deletingId: null, tagActionPostId: null, tagPickerPostId: null,
    refetchCurrentPostId: null, availableTags: [], getTagDisplayName: (tag) => tag.display_name,
    onDelete: vi.fn(), onRefetch: vi.fn(), onToggleTagFilter: vi.fn(), onOpenMedia: vi.fn(),
    onOpenVideo: vi.fn(), onToggleTagPicker: vi.fn(), onCloseTagPicker: vi.fn(),
    onAddTag: vi.fn(), onRemoveTag: vi.fn(), ...overrides
  };
  await act(async () => root.render(createElement(PostCard, props)));
}

it("hides Save media for posts containing only failed or pending media", async () => {
  await render({ post: { ...post, media: [
    { ...media, storage_status: "failed" },
    { ...media, media_id: "pending", storage_status: "pending" }
  ] } });
  expect(container.querySelector(".post-media-save-button")).toBeNull();
});

it("places Save before Refetch and saves the quoted post independently", async () => {
  const quoted = { ...post, x_post_id: "456", x_username: "quoted" };
  await render({ post: { ...post, quoted_post: quoted }, language: "en" });
  expect(container.querySelector(".post-card-actions button")?.textContent).toBe("Save media");
  const buttons = container.querySelectorAll<HTMLButtonElement>(".post-media-save-button");
  expect(buttons[0]!.getAttribute("aria-label")).toBe("Save media from post by @author");
  expect(buttons[1]!.getAttribute("aria-label")).toBe("Save media from post by @quoted");
  await act(async () => buttons[1]!.click());
  expect(downloadPostMedia).toHaveBeenCalledExactlyOnceWith(quoted);
});

it("disables while saving, displays partial failure, and clears it on retry", async () => {
  let finish!: (result: { failedCount: number }) => void;
  vi.mocked(downloadPostMedia).mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  await render();
  const button = container.querySelector<HTMLButtonElement>(".post-media-save-button")!;
  expect(button.getAttribute("aria-label")).toBe("@author の投稿のメディアを保存");
  await act(async () => button.click());
  expect(button.disabled).toBe(true);
  expect(button.textContent).toBe("保存中...");
  await act(async () => finish({ failedCount: 1 }));
  expect(button.disabled).toBe(false);
  expect(container.querySelector('[role="status"]')?.textContent).toBe("一部のメディアを保存できませんでした");
  await act(async () => button.click());
  expect(container.querySelector('[role="status"]')).toBeNull();
  await act(async () => finish({ failedCount: 0 }));
  expect(button.disabled).toBe(false);
});
