export type RuntimeMessageSender = {
  url?: string;
  id?: string;
  tab?: {
    id?: number;
  };
};

export function isFromExtensionViewer(
  sender: RuntimeMessageSender | undefined,
  getViewerOrigin: () => string
): boolean {
  if (sender === undefined) {
    return false;
  }

  const url = sender.url;

  if (typeof url !== "string" || url === "") {
    return false;
  }

  const viewerOrigin = getViewerOrigin();

  if (viewerOrigin === "") {
    return false;
  }

  return url.startsWith(viewerOrigin);
}

export function getCurrentExtensionUrlPrefix(): string {
  if (typeof chrome === "undefined" || chrome.runtime?.getURL === undefined) {
    return "";
  }

  return chrome.runtime.getURL("");
}
