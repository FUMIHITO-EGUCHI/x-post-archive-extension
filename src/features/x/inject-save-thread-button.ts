import { onXUiLanguageChange, xUiStrings } from "./x-ui-strings";
import type { SavePostInput } from "../../types/archive";

export type SaveThreadButtonState = "idle" | "saving" | "saved" | "error" | "disabled";

function isSaveThreadButtonState(value: string | undefined): value is SaveThreadButtonState {
  return value === "idle" || value === "saving" || value === "saved" || value === "error" || value === "disabled";
}

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
  button.dataset.xArchiveState = state;
  if (posts.length > 0) button.dataset.xArchiveCount = String(posts.length);
  button.hidden = state === "disabled";
  button.disabled = state === "saving" || state === "saved" || state === "disabled";
  const label = xUiStrings().thread[state](Number(button.dataset.xArchiveCount ?? 0));
  if (button.textContent !== label) button.textContent = label;
  button.setAttribute("aria-label", label);
  button.title = label;
  button.style.background = state === "error" ? "#fff1f1" : state === "saved" ? "#e7f8ee" : state === "saving" ? "#eef5fb" : "#0f62fe";
  button.style.color = state === "error" ? "#b42318" : state === "saved" ? "#157347" : state === "saving" ? "#4b6278" : "#ffffff";
  button.style.cursor = button.disabled ? "default" : "pointer";
}

onXUiLanguageChange(() => {
  const button = getSaveThreadButton();
  if (button !== null) {
    const state = button.dataset.xArchiveState;
    setSaveThreadButtonState(button, isSaveThreadButtonState(state) ? state : "disabled");
  }
});
