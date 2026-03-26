import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { PopupApp } from "../../features/popup/components/popup-app";

const container = document.getElementById("root");

if (container === null) {
  throw new Error("Popup root element was not found.");
}

createRoot(container).render(
  <StrictMode>
    <PopupApp />
  </StrictMode>
);
