import { handleRuntimeMessage } from "../features/runtime/handle-runtime-message";

export default defineBackground({
  type: "module",
  main() {
    chrome.runtime.onInstalled.addListener(() => {
      console.info("X Post Archive Extension foundation initialized.");
    });

    chrome.action.onClicked.addListener(() => {
      void chrome.tabs.create({
        url: chrome.runtime.getURL("/viewer.html")
      });
    });

    chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
      void handleRuntimeMessage(message).then((response) => {
        sendResponse(response);
      });

      return true;
    });
  }
});

