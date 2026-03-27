type SaveButtonState = "idle" | "saving" | "saved" | "error";

const BUTTON_SELECTOR = "[data-xpa-save-button]";

export function injectSaveButton(
  article: HTMLElement,
  onSave: () => Promise<void>
): HTMLButtonElement {
  const existing = article.querySelector<HTMLButtonElement>(BUTTON_SELECTOR);

  if (existing !== null) {
    return existing;
  }

  const button = document.createElement("button");
  button.type = "button";
  button.dataset.xpaSaveButton = "true";
  button.style.border = "1px solid #c5d7ea";
  button.style.background = "#ffffff";
  button.style.color = "#0f1419";
  button.style.borderRadius = "999px";
  button.style.padding = "6px 12px";
  button.style.fontSize = "13px";
  button.style.fontWeight = "700";
  button.style.cursor = "pointer";
  button.style.marginTop = "8px";
  button.style.alignSelf = "flex-start";
  button.style.zIndex = "1";
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
  switch (state) {
    case "idle":
      button.disabled = false;
      button.textContent = "保存";
      button.style.background = "#ffffff";
      button.style.color = "#0f1419";
      break;
    case "saving":
      button.disabled = true;
      button.textContent = "保存中...";
      button.style.background = "#eef5fb";
      button.style.color = "#4b6278";
      break;
    case "saved":
      button.disabled = true;
      button.textContent = "保存済み";
      button.style.background = "#e7f8ee";
      button.style.color = "#157347";
      break;
    case "error":
      button.disabled = false;
      button.textContent = "再試行";
      button.style.background = "#fff1f1";
      button.style.color = "#b42318";
      break;
  }
}

function findInsertionTarget(article: HTMLElement): HTMLElement {
  const actionGroup = article.querySelector<HTMLElement>('[role="group"]');

  if (actionGroup?.parentElement instanceof HTMLElement) {
    return actionGroup.parentElement;
  }

  return article;
}
