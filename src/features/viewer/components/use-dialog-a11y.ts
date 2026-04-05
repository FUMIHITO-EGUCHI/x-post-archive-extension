import { useEffect, useRef } from "react";
import type { RefObject } from "react";

type UseDialogA11yOptions = {
  isOpen: boolean;
  containerRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  initialFocusRef?: RefObject<HTMLElement | null>;
};

export function useDialogA11y({
  isOpen,
  containerRef,
  onClose,
  initialFocusRef
}: UseDialogA11yOptions) {
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const container = containerRef.current;

    if (container === null) {
      return undefined;
    }

    const previousActiveElement =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const containerElement = container;
    const animationFrameId = window.requestAnimationFrame(() => {
      const focusTarget =
        initialFocusRef?.current ??
        getFocusableElements(containerElement)[0] ??
        containerElement;

      focusTarget.focus();
    });

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusableElements = getFocusableElements(containerElement);

      if (focusableElements.length === 0) {
        event.preventDefault();
        containerElement.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;

      if (event.shiftKey) {
        if (activeElement === firstElement || activeElement === container) {
          event.preventDefault();
          lastElement?.focus();
        }

        return;
      }

      if (activeElement === lastElement) {
        event.preventDefault();
        firstElement?.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      document.removeEventListener("keydown", handleKeyDown);

      if (previousActiveElement?.isConnected) {
        previousActiveElement.focus();
      }
    };
  }, [containerRef, initialFocusRef, isOpen]);
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const selectors = [
    "button:not([disabled])",
    "a[href]",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "[tabindex]:not([tabindex='-1'])"
  ];

  return Array.from(container.querySelectorAll<HTMLElement>(selectors.join(","))).filter(
    (element) => !element.hasAttribute("hidden") && element.getClientRects().length > 0
  );
}
