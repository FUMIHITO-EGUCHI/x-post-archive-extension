import {
  createRuntimeErrorResponse,
  handleRuntimeMessage
} from "../features/runtime/handle-runtime-message";
import { resumePendingMediaPersistence } from "../features/archive/archive-service";

export default defineBackground({
  type: "module",
  main() {
    chrome.runtime.onInstalled.addListener(() => {
      console.info("X Post Archive Extension initialized.");
      void resumePendingMediaPersistence();
    });

    chrome.runtime.onStartup?.addListener?.(() => {
      void resumePendingMediaPersistence();
    });

    chrome.action.onClicked.addListener(() => {
      void chrome.tabs.create({
        url: chrome.runtime.getURL("/viewer.html")
      });
    });

    chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
      void handleRuntimeMessage(message)
        .then((response) => {
          sendResponse(response);
        })
        .catch((error: unknown) => {
          console.error("Runtime message handling failed.", error);
          sendResponse(createRuntimeErrorResponse(error));
        });

      return true;
    });
  }
});

