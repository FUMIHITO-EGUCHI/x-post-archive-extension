import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import type { cleanupDuplicateImageMedia } from "../../features/archive/archive-maintenance-service";
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

if (import.meta.env.DEV) {
  void import("../../features/archive/archive-maintenance-service").then(
    ({ cleanupDuplicateImageMedia }) => {
      window.__xPostArchiveCleanupDuplicateImages = cleanupDuplicateImageMedia;
    }
  );
}

createRoot(container).render(
  <StrictMode>
    <ViewerApp />
  </StrictMode>
);

