import {
  createRuntimeErrorResponse,
  handleRuntimeMessage
} from "../features/runtime/handle-runtime-message";
import { resumePendingMediaPersistence } from "../features/archive/archive-service";
import { createLogger } from "../features/logging/logger";

const logger = createLogger("background");

export default defineBackground({
  type: "module",
  main() {
    chrome.runtime.onInstalled.addListener(() => {
      logger.info("extension.installed", {
        message: "X Post Archive Extension initialized."
      });
      void resumePendingMediaPersistence();
    });

    chrome.runtime.onStartup?.addListener?.(() => {
      logger.info("extension.startup");
      void resumePendingMediaPersistence();
    });

    chrome.action.onClicked.addListener(() => {
      logger.info("viewer.opened");
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
          logger.error("runtime.message.unhandled_error", {
            message: "Runtime message handling failed.",
            context: {
              error
            }
          });
          sendResponse(createRuntimeErrorResponse(error));
        });

      return true;
    });
  }
});

