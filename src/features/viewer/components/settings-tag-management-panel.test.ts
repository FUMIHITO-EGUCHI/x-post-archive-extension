import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ArchiveTagSummaryRecord } from "../../../types/viewer";
import { requestMergeTags, requestRenameTag, requestTagSummaries } from "../../runtime/client";
import { SettingsTagManagementPanel } from "./settings-tag-management-panel";

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
  await act(async () => editor.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
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
