import { createUiIcon } from "./ui-icons";
import { onXUiLanguageChange, xUiStrings } from "./x-ui-strings";

export type SaveButtonState = "idle" | "saving" | "saved" | "error";

function isSaveButtonState(value: string | undefined): value is SaveButtonState {
  return value === "idle" || value === "saving" || value === "saved" || value === "error";
}

const BUTTON_SELECTOR = "[data-xpa-save-button]";
const transientStateTimers = new WeakMap<HTMLButtonElement, number>();

export function injectSaveButton(
  article: HTMLElement,
  onSave: () => Promise<void>
): HTMLButtonElement {
  const existing = article.querySelector<HTMLButtonElement>(BUTTON_SELECTOR);

  if (existing !== null) {
    existing.remove();
  }

  const button = document.createElement("button");
  button.type = "button";
  button.dataset.xpaSaveButton = "true";
  Object.assign(button.style, {
    border: "0",
    background: "transparent",
    color: "#536471",
    borderRadius: "50%",
    width: "32px",
    height: "32px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0",
    cursor: "pointer",
    flex: "0 0 auto"
  });
  button.addEventListener("mouseenter", () => {
    if (button.dataset.xArchiveState === "idle") {
      button.style.color = "#1d9bf0";
      button.style.background = "rgba(29,155,240,.1)";
    }
  });
  button.addEventListener("mouseleave", () => {
    button.style.background = "transparent";
    if (button.dataset.xArchiveState === "idle") button.style.color = "#536471";
  });
  setButtonState(button, "idle");

  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (button.disabled) {
      return;
    }

    void (async () => {
      setButtonState(button, "saving");

      try {
        await onSave();
        setButtonState(button, "saved");
      } catch (error) {
        console.error("Failed to save post.", error);
        setButtonState(button, "error");
      }
    })();
  });

  const target = findInsertionTarget(article);
  target.appendChild(button);

  return button;
}

export function setButtonState(button: HTMLButtonElement, state: SaveButtonState): void {
  clearTransientStateTimer(button);
  applyButtonState(button, state);
}

export function flashButtonState(
  button: HTMLButtonElement,
  state: SaveButtonState,
  restoreState: SaveButtonState,
  durationMs = 3000
): void {
  clearTransientStateTimer(button);
  applyButtonState(button, state);

  const timerId = window.setTimeout(() => {
    transientStateTimers.delete(button);
    applyButtonState(button, restoreState);
  }, durationMs);

  transientStateTimers.set(button, timerId);
}

function applyButtonState(button: HTMLButtonElement, state: SaveButtonState): void {
  button.dataset.xArchiveState = state;
  button.disabled = state === "saving" || state === "saved";
  button.setAttribute("aria-label", xUiStrings().save[state]);
  button.title = xUiStrings().save[state];
  button.style.color = state === "saved" ? "#00ba7c" : state === "error" ? "#f4212e" : "#536471";
  button.style.background = "transparent";
  const icon = createUiIcon(
    state === "idle" ? "archive" : state === "saving" ? "spinner" : state === "saved" ? "check" : "alert"
  );
  button.replaceChildren(icon);
  if (state === "saving" && typeof icon.animate === "function" && !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
    icon.animate(
      [{ transform: "rotate(0deg)" }, { transform: "rotate(360deg)" }],
      { duration: 1000, iterations: Infinity }
    );
  }
}

function clearTransientStateTimer(button: HTMLButtonElement): void {
  const timerId = transientStateTimers.get(button);

  if (timerId === undefined) {
    return;
  }

  window.clearTimeout(timerId);
  transientStateTimers.delete(button);
}

function findInsertionTarget(article: HTMLElement): HTMLElement {
  const actionGroup = article.querySelector<HTMLElement>('[role="group"]');

  if (actionGroup instanceof HTMLElement) {
    return actionGroup;
  }

  return article;
}

onXUiLanguageChange(() => {
  document.querySelectorAll<HTMLButtonElement>(BUTTON_SELECTOR).forEach((button) => {
    const state = button.dataset.xArchiveState;
    applyButtonState(button, isSaveButtonState(state) ? state : "idle");
  });
});
