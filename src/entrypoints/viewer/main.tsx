import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ViewerApp } from "../../features/viewer/components/viewer-app";

const container = document.getElementById("root");

if (container === null) {
  throw new Error("Viewer root element was not found.");
}

createRoot(container).render(
  <StrictMode>
    <ViewerApp />
  </StrictMode>
);

