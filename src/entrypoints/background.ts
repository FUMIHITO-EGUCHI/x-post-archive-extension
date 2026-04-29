import {
  createRuntimeErrorResponse,
  handleRuntimeMessage
} from "../features/runtime/handle-runtime-message";
import { resumePendingMediaPersistence } from "../features/archive/archive-service";
import { resumeThreadExpandProcessing } from "../features/archive/thread-expand-worker";
import { resumeRefetchProcessing } from "../features/refetch/refetch-coordinator";
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
      void resumeRefetchProcessing();
      void resumeThreadExpandProcessing();
    });

    chrome.runtime.onStartup?.addListener?.(() => {
      logger.info("extension.startup");
      void resumePendingMediaPersistence();
      void resumeRefetchProcessing();
      void resumeThreadExpandProcessing();
    });

    chrome.action.onClicked.addListener(() => {
      logger.info("viewer.opened");
      void chrome.tabs.create({
        url: chrome.runtime.getURL("/viewer.html")
      });
    });

    chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
      let normalizedSender:
        | {
            tab?: {
              id?: number;
            };
          }
        | undefined;

      if (typeof sender === "object" && sender !== null) {
        const rawTab = Reflect.get(sender, "tab");

        if (typeof rawTab === "object" && rawTab !== null) {
          const rawTabId = Reflect.get(rawTab, "id");
          normalizedSender =
            typeof rawTabId === "number"
              ? {
                  tab: {
                    id: rawTabId
                  }
                }
              : {
                  tab: {}
                };
        } else {
          normalizedSender = {};
        }
      }

      void handleRuntimeMessage(message, normalizedSender)
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

