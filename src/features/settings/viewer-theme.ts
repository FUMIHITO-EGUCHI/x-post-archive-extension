import type { ViewerTheme } from "../../types/viewer";

const VIEWER_THEME_STORAGE_KEY = "viewerTheme";

export async function loadViewerTheme(): Promise<ViewerTheme> {
  const stored = await browser.storage.local.get(VIEWER_THEME_STORAGE_KEY);
  const candidate = stored[VIEWER_THEME_STORAGE_KEY];

  return isViewerTheme(candidate) ? candidate : "light";
}

export async function persistViewerTheme(theme: ViewerTheme): Promise<void> {
  await browser.storage.local.set({
    [VIEWER_THEME_STORAGE_KEY]: theme
  });
}

function isViewerTheme(value: unknown): value is ViewerTheme {
  return value === "light" || value === "dark";
}
