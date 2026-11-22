import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
  vi.resetModules();
});

it("updates save and thread controls when the archive language changes", async () => {
  let changed: ((changes: Record<string, { newValue: string }>, area: string) => void) | undefined;
  vi.stubGlobal("browser", {
    i18n: { getUILanguage: () => "en" },
    storage: {
      local: { get: async () => ({ "archive.language": "en" }) },
      onChanged: { addListener: (listener: typeof changed) => { changed = listener; } }
    }
  });
  const { injectSaveButton, setButtonState } = await import("./inject-save-button");
  const { injectSaveThreadButton, setSaveThreadButtonState } = await import("./inject-save-thread-button");
  const article = document.createElement("article");
  const group = document.createElement("div");
  group.setAttribute("role", "group");
  article.append(group);
  document.body.append(article);
  const button = injectSaveButton(article, async () => {});
  const thread = injectSaveThreadButton(async () => {});
  await Promise.resolve();
  expect(button.parentElement).toBe(group);
  expect(button.getAttribute("aria-label")).toBe("Save to archive");
  expect(button.querySelector("svg")).not.toBeNull();
  setButtonState(button, "error");
  expect(button.disabled).toBe(false);
  expect(button.dataset.xArchiveState).toBe("error");
  setSaveThreadButtonState(thread, "disabled");
  expect(thread.hidden).toBe(true);
  changed?.({ "archive.language": { newValue: "ja" } }, "local");
  expect(button.title).toBe("保存に失敗。押すと再試行");
  expect(thread.title).toBe("連投ではありません");
  expect(thread.hidden).toBe(true);
  setButtonState(button, "saving");
  expect(button.getAttribute("aria-label")).toBe("保存中");
  expect(button.disabled).toBe(true);
  button.dataset.xArchiveState = "invalid";
  thread.dataset.xArchiveState = "invalid";
  changed?.({ "archive.language": { newValue: "en" } }, "local");
  expect(button.dataset.xArchiveState).toBe("idle");
  expect(button.title).toBe("Save to archive");
  expect(thread.dataset.xArchiveState).toBe("disabled");
  expect(thread.hidden).toBe(true);
});

it("updates the open import overlay without resetting its state", async () => {
  let changed: ((changes: Record<string, { newValue: string }>, area: string) => void) | undefined;
  vi.stubGlobal("browser", {
    i18n: { getUILanguage: () => "en" },
    storage: {
      local: { get: async () => ({ "archive.language": "en" }) },
      onChanged: { addListener: (listener: typeof changed) => { changed = listener; } }
    }
  });
  const { createTimelineImportControls } = await import("./timeline-import-controls");
  const controls = createTimelineImportControls({
    pageKind: "likes",
    rootId: "test-root", overlayId: "test-overlay", toggleButtonId: "test-toggle",
    actionButtonId: "test-action", traceEventPrefix: "test", isTimelinePage: () => true,
    autoTagOptions: { includeBookmarkedTag: true }
  });
  controls.ensureImportControls();
  await Promise.resolve();
  expect(document.querySelector("#test-toggle")?.textContent).toBe("Import Likes");
  document.querySelector<HTMLButtonElement>("#test-toggle")!.click();
  const overlay = document.querySelector<HTMLElement>("#test-overlay")!;
  expect(overlay.hidden).toBe(false);
  expect(overlay.querySelector("[data-xpa-overlay-status]")?.textContent).toBe("Idle");
  expect(overlay.querySelector("progress")).not.toBeNull();
  expect(overlay.querySelector("[data-xpa-overlay-streak] svg path")?.getAttribute("d"))
    .toBe("M9 5v14 M15 5v14");
  changed?.({ "archive.language": { newValue: "ja" } }, "local");
  expect(overlay.hidden).toBe(false);
  expect(overlay.querySelector("[data-xpa-overlay-status]")?.textContent).toBe("待機中");
  expect(document.querySelector("#test-action")?.textContent).toBe("開始");
  expect(overlay.querySelector("[data-xpa-overlay-label-collected]")?.textContent).toBe("収集");
  controls.removeImportControls();
});
