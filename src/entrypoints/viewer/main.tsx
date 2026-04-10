import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { cleanupDuplicateImageMedia } from "../../features/archive/archive-maintenance-service";
import { ViewerApp } from "../../features/viewer/components/viewer-app";

const container = document.getElementById("root");

declare global {
  interface Window {
    __xPostArchiveCleanupDuplicateImages?: typeof cleanupDuplicateImageMedia;
  }
}

if (container === null) {
  throw new Error("Viewer root element was not found.");
}

window.__xPostArchiveCleanupDuplicateImages = cleanupDuplicateImageMedia;

createRoot(container).render(
  <StrictMode>
    <ViewerApp />
  </StrictMode>
);

