import type { SavePostInput } from "../../types/archive";

export type SaveThreadButtonState = "idle" | "saving" | "saved" | "error" | "disabled";

const THREAD_BUTTON_ROOT_ID = "xpa-save-thread-root";
const THREAD_BUTTON_SELECTOR = "[data-xpa-save-thread-button]";

export function injectSaveThreadButton(onSave: () => Promise<void>): HTMLButtonElement {
  const existing = getSaveThreadButton();

  if (existing !== null) {
    return existing;
  }

  const root = document.createElement("div");
  root.id = THREAD_BUTTON_ROOT_ID;
  root.style.position = "fixed";
  root.style.right = "20px";
  root.style.bottom = "24px";
  root.style.zIndex = "2147483647";

  const button = document.createElement("button");
  button.type = "button";
  button.dataset.xpaSaveThreadButton = "true";
  button.style.border = "1px solid #2f6fed";
  button.style.background = "#0f62fe";
  button.style.color = "#ffffff";
  button.style.borderRadius = "999px";
  button.style.padding = "9px 14px";
  button.style.fontSize = "13px";
  button.style.fontWeight = "700";
  button.style.cursor = "pointer";
  button.style.boxShadow = "0 8px 24px rgba(15, 20, 25, 0.18)";

  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (button.disabled) {
      return;
    }

    void (async () => {
      setSaveThreadButtonState(button, "saving");

      try {
        await onSave();
        setSaveThreadButtonState(button, "saved");
      } catch (error) {
        console.error("Failed to save thread.", error);
        setSaveThreadButtonState(button, "error");
      }
    })();
  });

  root.appendChild(button);
  document.body.appendChild(root);

  return button;
}

export function getSaveThreadButton(): HTMLButtonElement | null {
  return document.querySelector<HTMLButtonElement>(THREAD_BUTTON_SELECTOR);
}

export function removeSaveThreadButton(): void {
  document.getElementById(THREAD_BUTTON_ROOT_ID)?.remove();
}

export function setSaveThreadButtonState(
  button: HTMLButtonElement,
  state: SaveThreadButtonState,
  posts: SavePostInput[] = []
): void {
  switch (state) {
    case "idle":
      button.disabled = false;
      button.textContent = `連投を保存（${posts.length}件）`;
      button.style.background = "#0f62fe";
      button.style.borderColor = "#2f6fed";
      button.style.color = "#ffffff";
      button.style.cursor = "pointer";
      break;
    case "saving":
      button.disabled = true;
      button.textContent = "連投を保存中...";
      button.style.background = "#eef5fb";
      button.style.borderColor = "#c5d7ea";
      button.style.color = "#4b6278";
      button.style.cursor = "wait";
      break;
    case "saved":
      button.disabled = true;
      button.textContent = "連投を保存済み";
      button.style.background = "#e7f8ee";
      button.style.borderColor = "#9bd4b5";
      button.style.color = "#157347";
      button.style.cursor = "default";
      break;
    case "error":
      button.disabled = false;
      button.textContent = "連投保存を再試行";
      button.style.background = "#fff1f1";
      button.style.borderColor = "#f0b4b4";
      button.style.color = "#b42318";
      button.style.cursor = "pointer";
      break;
    case "disabled":
      button.disabled = true;
      button.textContent = "連投ではありません";
      button.style.background = "#f5f7f9";
      button.style.borderColor = "#d7dee5";
      button.style.color = "#697784";
      button.style.cursor = "default";
      break;
  }
}
