import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ArchiveTagSummaryRecord } from "../../../types/viewer";
import { requestMergeTags, requestRenameTag, requestTagSummaries } from "../../runtime/client";
import { getNextRowIndex, SettingsTagManagementPanel } from "./settings-tag-management-panel";

vi.mock("../../runtime/client", () => ({
  requestTagSummaries: vi.fn(),
  requestRenameTag: vi.fn(),
  requestMergeTags: vi.fn()
}));

const tags: ArchiveTagSummaryRecord[] = [
  {
    tag: {
      tag_id: "uma",
      display_name: "ウマ娘",
      normalized_name: "ウマ娘",
      system_key: null,
      source: "manual"
    },
    postCount: 230
  },
  {
    tag: {
      tag_id: "blue",
      display_name: "ブルアカ",
      normalized_name: "ブルアカ",
      system_key: null,
      source: "manual"
    },
    postCount: 178
  },
  {
    tag: {
      tag_id: "archive",
      display_name: "ブルーアーカイブ",
      normalized_name: "ブルーアーカイブ",
      system_key: null,
      source: "manual"
    },
    postCount: 42
  }
];

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.mocked(requestTagSummaries).mockResolvedValue({ type: "posts/tags/list-result", tags });
  vi.mocked(requestRenameTag).mockResolvedValue({
    type: "tag.rename",
    ok: true,
    tag: {
      tag_id: "uma",
      display_name: "New name",
      normalized_name: "new name",
      system_key: null,
      created_at: 1
    }
  });
  vi.mocked(requestMergeTags).mockResolvedValue({
    type: "tag.merge",
    mergedPostCount: 1,
    removedDuplicateCount: 0
  });
});

afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});

async function setup() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const onTagRenamed = vi.fn(async () => {});
  const onTagMerged = vi.fn(async () => {});
  await act(async () => root.render(createElement(SettingsTagManagementPanel, {
    language: "en",
    onTagRenamed,
    onTagMerged
  })));
  return {
    container,
    onTagRenamed,
    onTagMerged,
    async cleanup() {
      await act(async () => root.unmount());
      container.remove();
    }
  };
}

function button(container: HTMLElement, label: string): HTMLButtonElement {
  const found = [...container.querySelectorAll("button")].find((element) =>
    element.getAttribute("aria-label") === label || element.textContent === label);
  if (!found) {
    throw new Error(`Button not found: ${label}`);
  }
  return found;
}

async function click(element: HTMLElement) {
  await act(async () => element.click());
}

async function changeInput(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (!setter) {
    throw new Error("Input value setter unavailable");
  }
  await act(async () => {
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function input(container: HTMLElement): HTMLInputElement {
  const found = container.querySelector('input[aria-label="New tag name"]');
  if (!(found instanceof HTMLInputElement)) {
    throw new Error("Rename input not found");
  }
  return found;
}

function row(container: HTMLElement, name: string): HTMLElement {
  const found = button(container, `Rename ${name}`).closest('[role="row"]');
  if (!(found instanceof HTMLElement)) {
    throw new Error("Tag row not found");
  }
  return found;
}

it("renames inline when Enter is pressed", async () => {
  const view = await setup();
  expect([...view.container.querySelectorAll("button")].some((element) =>
    element.textContent === "Rename" || element.textContent === "リネーム")).toBe(false);
  await click(button(view.container, "Rename ウマ娘"));
  const editor = input(view.container);
  expect(editor.value).toBe("ウマ娘");
  expect(document.activeElement).toBe(editor);
  await changeInput(editor, " New name ");
  await act(async () => editor.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
  ));
  expect(requestRenameTag).toHaveBeenCalledWith("uma", "New name");
  expect(view.onTagRenamed).toHaveBeenCalledWith("ウマ娘", "new name");
  await view.cleanup();
});

it("closes the editor after a pending rename succeeds", async () => {
  let resolveRename: (value: Awaited<ReturnType<typeof requestRenameTag>>) => void = () => {
    throw new Error("Rename request was not started");
  };
  vi.mocked(requestRenameTag).mockImplementationOnce(() => new Promise((resolve) => {
    resolveRename = resolve;
  }));
  const view = await setup();
  await click(button(view.container, "Rename ウマ娘"));
  await changeInput(input(view.container), "New name");
  await click(button(view.container, "Save"));
  expect(input(view.container).disabled).toBe(true);
  await act(async () => {
    resolveRename({
      type: "tag.rename",
      ok: true,
      tag: {
        tag_id: "uma",
        display_name: "New name",
        normalized_name: "new name",
        system_key: null,
        created_at: 1
      }
    });
  });
  expect(view.container.textContent).toContain('Renamed tag to "New name".');
  expect(view.container.querySelector('input[aria-label="New tag name"]')).toBeNull();
  await view.cleanup();
});

it("keeps a newer edit open when the previous rename resolves", async () => {
  let resolveRename: (value: Awaited<ReturnType<typeof requestRenameTag>>) => void = () => {
    throw new Error("Rename request was not started");
  };
  vi.mocked(requestRenameTag).mockImplementationOnce(() => new Promise((resolve) => {
    resolveRename = resolve;
  }));
  const view = await setup();
  await click(button(view.container, "Rename ウマ娘"));
  await changeInput(input(view.container), "New name");
  await act(async () => {
    input(view.container).blur();
    button(view.container, "Rename ブルアカ").click();
  });
  expect(input(view.container).value).toBe("ブルアカ");
  await act(async () => {
    resolveRename({
      type: "tag.rename",
      ok: true,
      tag: {
        tag_id: "uma",
        display_name: "New name",
        normalized_name: "new name",
        system_key: null,
        created_at: 1
      }
    });
  });
  expect(input(view.container).value).toBe("ブルアカ");
  await view.cleanup();
});

it("does not show a previous rename collision on a newer edit", async () => {
  let resolveRename: (value: Awaited<ReturnType<typeof requestRenameTag>>) => void = () => {
    throw new Error("Rename request was not started");
  };
  vi.mocked(requestRenameTag).mockImplementationOnce(() => new Promise((resolve) => {
    resolveRename = resolve;
  }));
  const view = await setup();
  await click(button(view.container, "Rename ウマ娘"));
  await changeInput(input(view.container), "ブルーアーカイブ");
  await act(async () => {
    input(view.container).blur();
    button(view.container, "Rename ブルアカ").click();
  });
  await act(async () => {
    resolveRename({
      type: "tag.rename",
      ok: false,
      error: "collision",
      conflictingTagId: "archive"
    });
  });
  expect(input(view.container).value).toBe("ブルアカ");
  expect(view.container.querySelector('[role="alert"]')).toBeNull();
  await view.cleanup();
});

it("offers to merge a colliding name in the correct direction", async () => {
  vi.mocked(requestRenameTag).mockResolvedValueOnce({
    type: "tag.rename",
    ok: false,
    error: "collision",
    conflictingTagId: "blue"
  });
  const view = await setup();
  await click(button(view.container, "Rename ウマ娘"));
  await changeInput(input(view.container), "ブルアカ");
  await act(async () => input(view.container).dispatchEvent(
    new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
  ));
  expect(input(view.container).getAttribute("aria-invalid")).toBe("true");
  await click(button(view.container, 'Merge into "ブルアカ"'));
  expect(view.container.querySelector('[aria-label="Source tag"]')?.textContent).toContain("ウマ娘");
  expect(view.container.querySelector('[aria-label="Target tag"]')?.textContent).toContain("ブルアカ");
  await view.cleanup();
});

it("confirms a merge in two steps", async () => {
  const view = await setup();
  await click(row(view.container, "ウマ娘"));
  await click(row(view.container, "ブルアカ"));
  await click(button(view.container, "Merge"));
  expect(requestMergeTags).not.toHaveBeenCalled();
  expect(button(view.container, "Confirm merge")).toBeDefined();
  await click(button(view.container, "Confirm merge"));
  expect(requestMergeTags).toHaveBeenCalledWith("uma", "blue", true);
  expect(view.onTagMerged).toHaveBeenCalledWith("ウマ娘", "ブルアカ");
  await view.cleanup();
});

it("swaps the merge direction and disarms confirmation", async () => {
  const view = await setup();
  await click(row(view.container, "ウマ娘"));
  await click(row(view.container, "ブルアカ"));
  await click(button(view.container, "Merge"));
  await click(button(view.container, "Swap source and target"));
  expect(view.container.querySelector('[aria-label="Source tag"]')?.textContent).toContain("ブルアカ");
  expect(view.container.querySelector('[aria-label="Target tag"]')?.textContent).toContain("ウマ娘");
  await click(button(view.container, "Merge"));
  expect(requestMergeTags).not.toHaveBeenCalled();
  await click(button(view.container, "Confirm merge"));
  expect(requestMergeTags).toHaveBeenCalledWith("blue", "uma", true);
  await view.cleanup();
});

it("saves on blur and cancels unchanged or escaped edits", async () => {
  const view = await setup();
  await click(button(view.container, "Rename ウマ娘"));
  await act(async () => input(view.container).blur());
  expect(requestRenameTag).not.toHaveBeenCalled();
  await click(button(view.container, "Rename ウマ娘"));
  await changeInput(input(view.container), "Discarded");
  await act(async () => input(view.container).dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
  ));
  expect(requestRenameTag).not.toHaveBeenCalled();
  await click(button(view.container, "Rename ウマ娘"));
  await changeInput(input(view.container), "New name");
  await act(async () => input(view.container).blur());
  expect(requestRenameTag).toHaveBeenCalledWith("uma", "New name");
  await view.cleanup();
});

it("disarms on selection or rename and honors auto-redirect setting", async () => {
  const view = await setup();
  await click(row(view.container, "ウマ娘"));
  await click(row(view.container, "ブルアカ"));
  await click(button(view.container, "Merge"));
  await click(row(view.container, "ブルアカ"));
  await click(row(view.container, "ブルアカ"));
  await click(button(view.container, "Merge"));
  await click(button(view.container, "Rename ウマ娘"));
  expect(button(view.container, "Merge")).toBeDefined();
  await click(button(view.container, "Cancel"));
  const checkbox = view.container.querySelector('input[type="checkbox"]');
  if (!(checkbox instanceof HTMLInputElement)) {
    throw new Error("Auto-redirect checkbox not found");
  }
  await click(checkbox);
  await click(button(view.container, "Merge"));
  await click(button(view.container, "Confirm merge"));
  expect(requestMergeTags).toHaveBeenCalledWith("uma", "blue", false);
  await view.cleanup();
});

it("keeps a collision open on blur and removes the error when typing", async () => {
  vi.mocked(requestRenameTag).mockResolvedValueOnce({
    type: "tag.rename",
    ok: false,
    error: "collision",
    conflictingTagId: "blue"
  });
  const view = await setup();
  await click(button(view.container, "Rename ウマ娘"));
  await changeInput(input(view.container), "ブルアカ");
  await act(async () => input(view.container).dispatchEvent(
    new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
  ));
  await act(async () => input(view.container).blur());
  expect(requestRenameTag).toHaveBeenCalledTimes(1);
  expect(button(view.container, 'Merge into "ブルアカ"')).toBeDefined();
  await changeInput(input(view.container), "Different");
  expect(view.container.querySelector('[role="alert"]')).toBeNull();
  await view.cleanup();
});

it("does not resend a failed rename when the input loses focus", async () => {
  vi.mocked(requestRenameTag).mockRejectedValueOnce(new Error("Network down"));
  const view = await setup();
  await click(button(view.container, "Rename ウマ娘"));
  const editor = input(view.container);
  await changeInput(editor, "New name");
  await act(async () => {
    editor.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  });
  expect(view.container.querySelector('[role="alert"]')?.textContent).toContain("Network down");
  await act(async () => {
    input(view.container).dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
  });
  expect(requestRenameTag).toHaveBeenCalledTimes(1);
  await view.cleanup();
});

it("opens another tag for editing while the previous rename is still saving", async () => {
  let finish!: (value: Awaited<ReturnType<typeof requestRenameTag>>) => void;
  vi.mocked(requestRenameTag).mockImplementationOnce(() => new Promise((resolve) => {
    finish = resolve;
  }));
  const view = await setup();
  await click(button(view.container, "Rename ウマ娘"));
  const editor = input(view.container);
  await changeInput(editor, "ブルアカ");
  await act(async () => {
    editor.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
  });
  expect(requestRenameTag).toHaveBeenCalledExactlyOnceWith("uma", "ブルアカ");
  await click(button(view.container, "Rename ブルーアーカイブ"));
  expect(input(view.container).value).toBe("ブルーアーカイブ");
  await act(async () => {
    finish({ type: "tag.rename", ok: false, error: "collision", conflictingTagId: "blue" });
  });
  expect(input(view.container).value).toBe("ブルーアーカイブ");
  expect(view.container.querySelector('[role="alert"]')).toBeNull();
  expect(view.container.textContent).toContain('Could not rename "ウマ娘": "ブルアカ" already exists.');
  await view.cleanup();
});

it("keeps a second tag locked until its own rename finishes", async () => {
  type RenameResult = Awaited<ReturnType<typeof requestRenameTag>>;
  const finishers: Array<(value: RenameResult) => void> = [];
  vi.mocked(requestRenameTag).mockImplementation(() => new Promise((resolve) => {
    finishers.push(resolve);
  }));
  const view = await setup();
  await click(button(view.container, "Rename ウマ娘"));
  await changeInput(input(view.container), "Uma");
  await act(async () => {
    input(view.container).dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
  });
  await click(button(view.container, "Rename ブルーアーカイブ"));
  await changeInput(input(view.container), "Blue Archive");
  await act(async () => {
    input(view.container).dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
    );
  });
  expect(requestRenameTag).toHaveBeenCalledTimes(2);
  expect(input(view.container).disabled).toBe(true);
  await act(async () => {
    finishers[0]!({ type: "tag.rename", ok: false, error: "collision", conflictingTagId: "blue" });
  });
  expect(input(view.container).disabled).toBe(true);
  await click(button(view.container, "Save"));
  expect(requestRenameTag).toHaveBeenCalledTimes(2);
  await view.cleanup();
});

async function press(element: HTMLElement, key: string) {
  await act(async () => {
    element.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
  });
}

it("keeps a single tab stop in the tag list", async () => {
  const view = await setup();
  const rows = [...view.container.querySelectorAll<HTMLElement>("[data-tag-id]")];
  expect(rows.filter((element) => element.tabIndex === 0)).toHaveLength(1);
  expect(rows.filter((element) => element.tabIndex === -1)).toHaveLength(2);
  const names = [...view.container.querySelectorAll<HTMLButtonElement>(
    ".viewer-tag-management-name"
  )];
  expect(names.every((element) => element.tabIndex === -1)).toBe(true);
  await view.cleanup();
});

it("moves between rows with arrow keys, Home and End", async () => {
  const view = await setup();
  const rows = [...view.container.querySelectorAll<HTMLElement>("[data-tag-id]")];
  rows[0]!.focus();
  await press(rows[0]!, "ArrowDown");
  expect(document.activeElement).toBe(rows[1]!);
  expect(rows[1]!.tabIndex).toBe(0);
  expect(rows[0]!.tabIndex).toBe(-1);
  await press(rows[1]!, "ArrowUp");
  expect(document.activeElement).toBe(rows[0]!);
  await press(rows[0]!, "End");
  expect(document.activeElement).toBe(rows[2]!);
  await press(rows[2]!, "Home");
  expect(document.activeElement).toBe(rows[0]!);
  await view.cleanup();
});

it("loads more tags when moving past the last displayed row", async () => {
  const manyTags = Array.from({ length: 51 }, (_, index) => ({
    tag: { ...tags[0]!.tag, tag_id: `tag-${index}`, display_name: `Tag ${index}` },
    postCount: 100 - index
  }));
  vi.mocked(requestTagSummaries).mockResolvedValueOnce({
    type: "posts/tags/list-result", tags: manyTags
  });
  const view = await setup();
  const rows = [...view.container.querySelectorAll<HTMLElement>("[data-tag-id]")];
  expect(rows).toHaveLength(50);
  rows[49]!.focus();
  await press(rows[49]!, "ArrowDown");
  const expanded = [...view.container.querySelectorAll<HTMLElement>("[data-tag-id]")];
  expect(expanded).toHaveLength(51);
  expect(document.activeElement).toBe(expanded[50]!);
  expect(expanded[50]!.tabIndex).toBe(0);
  await view.cleanup();
});

it("keeps loaded rows when a row is selected after showing more", async () => {
  const manyTags = Array.from({ length: 51 }, (_, index) => ({
    tag: { ...tags[0]!.tag, tag_id: `tag-${index}`, display_name: `Tag ${index}` },
    postCount: 100 - index
  }));
  vi.mocked(requestTagSummaries).mockResolvedValueOnce({
    type: "posts/tags/list-result", tags: manyTags
  });
  const view = await setup();
  const more = [...view.container.querySelectorAll("button")]
    .find((button) => button.textContent === "1 more")!;
  await click(more);
  expect(view.container.querySelectorAll("[data-tag-id]")).toHaveLength(51);
  await click(view.container.querySelector<HTMLElement>('[data-tag-id="tag-0"]')!);
  expect(view.container.querySelectorAll("[data-tag-id]")).toHaveLength(51);
  await view.cleanup();
});

it("keeps the focused row rendered after deselecting it past the first page", async () => {
  const manyTags = Array.from({ length: 51 }, (_, index) => ({
    tag: { ...tags[0]!.tag, tag_id: `tag-${index}`, display_name: `Tag ${index}` },
    postCount: 100 - index
  }));
  vi.mocked(requestTagSummaries).mockResolvedValueOnce({
    type: "posts/tags/list-result", tags: manyTags
  });
  const view = await setup();
  const rows = [...view.container.querySelectorAll<HTMLElement>("[data-tag-id]")];
  rows[49]!.focus();
  await press(rows[49]!, "ArrowDown");
  const lastRow = view.container.querySelector<HTMLElement>('[data-tag-id="tag-50"]')!;
  await press(lastRow, " ");
  expect(lastRow.getAttribute("aria-selected")).toBe("true");
  await press(lastRow, " ");
  const after = view.container.querySelector<HTMLElement>('[data-tag-id="tag-50"]');
  expect(after).not.toBeNull();
  expect(after!.getAttribute("aria-selected")).toBe("false");
  expect(document.activeElement).toBe(after);
  await view.cleanup();
});

it("reaches locked rows but does not select them", async () => {
  const view = await setup();
  const rows = [...view.container.querySelectorAll<HTMLElement>("[data-tag-id]")];
  await click(rows[0]!);
  await click(rows[1]!);
  rows[1]!.focus();
  await press(rows[1]!, "ArrowDown");
  expect(document.activeElement).toBe(rows[2]!);
  expect(rows[2]!.getAttribute("aria-disabled")).toBe("true");
  await press(rows[2]!, " ");
  expect(rows[2]!.getAttribute("aria-selected")).toBe("false");
  expect(rows.slice(0, 2).every((element) => element.getAttribute("aria-selected") === "true"))
    .toBe(true);
  await view.cleanup();
});

it("starts a rename with F2 and returns focus on Escape", async () => {
  const view = await setup();
  const first = view.container.querySelector<HTMLElement>("[data-tag-id]");
  if (!first) {
    throw new Error("Tag row not found");
  }
  first.focus();
  await press(first, "F2");
  expect(document.activeElement).toBe(input(view.container));
  await press(input(view.container), "Escape");
  expect(view.container.querySelector('input[aria-label="New tag name"]')).toBeNull();
  expect(document.activeElement).toBe(first);
  await press(first, "F2");
  await press(input(view.container), "Enter");
  expect(document.activeElement).toBe(first);
  await press(first, "F2");
  await changeInput(input(view.container), "New name");
  await press(input(view.container), "Enter");
  const restored = view.container.querySelector<HTMLElement>('[data-tag-id="uma"]');
  expect(document.activeElement).toBe(restored);
  await view.cleanup();
});

it("maps navigation keys to row indexes and leaves End on the loaded rows", () => {
  expect(getNextRowIndex("ArrowDown", 49, 50, 120)).toBe(50);
  expect(getNextRowIndex("ArrowDown", 119, 120, 120)).toBe(119);
  expect(getNextRowIndex("ArrowUp", 0, 50, 120)).toBe(0);
  expect(getNextRowIndex("Home", 30, 50, 120)).toBe(0);
  expect(getNextRowIndex("End", 3, 50, 120)).toBe(49);
  expect(getNextRowIndex("Tab", 3, 50, 120)).toBeNull();
});

it("keeps the list on screen while tags reload after a rename", async () => {
  const view = await setup();
  vi.mocked(requestTagSummaries).mockImplementationOnce(() => new Promise(() => {}));
  await click(button(view.container, "Rename ウマ娘"));
  await changeInput(input(view.container), "New name");
  await click(button(view.container, "Save"));
  expect(view.container.textContent).not.toContain("Loading tags...");
  expect(view.container.querySelectorAll("[data-tag-id]")).toHaveLength(3);
  await view.cleanup();
});

it("applies only the latest tag list when reloads finish out of order", async () => {
  type TagListResponse = Awaited<ReturnType<typeof requestTagSummaries>>;
  const resolvers: Array<(value: TagListResponse) => void> = [];
  const view = await setup();
  vi.mocked(requestTagSummaries).mockImplementation(() => new Promise((resolve) => {
    resolvers.push(resolve);
  }));
  // Rename A succeeds and its reload stays pending; then rename B starts a second reload.
  await click(button(view.container, "Rename ウマ娘"));
  await changeInput(input(view.container), "Uma");
  await click(button(view.container, "Save"));
  await click(button(view.container, "Rename ブルーアーカイブ"));
  await changeInput(input(view.container), "BA");
  await click(button(view.container, "Save"));
  expect(resolvers).toHaveLength(2);
  const renamed = {
    ...tags[2]!,
    tag: { ...tags[2]!.tag, display_name: "BA", normalized_name: "ba" }
  };
  await act(async () => {
    resolvers[1]!({ type: "posts/tags/list-result", tags: [tags[1]!, renamed] });
  });
  expect(view.container.querySelector('[data-tag-id="uma"]')).toBeNull();
  await act(async () => {
    resolvers[0]!({ type: "posts/tags/list-result", tags });
  });
  expect(view.container.textContent).toContain("BA");
  expect(view.container.querySelector('[data-tag-id="uma"]')).toBeNull();
  await view.cleanup();
});
