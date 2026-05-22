import {
  createRuntimeErrorResponse,
  handleRuntimeMessage
} from "../features/runtime/handle-runtime-message";
import { resumePendingMediaPersistence } from "../features/archive/archive-service";
import { getChromeAlarmsApi } from "../features/archive/chrome-alarms";
import {
  isThreadExpandResumeAlarm,
  resumeThreadExpandProcessing
} from "../features/archive/thread-expand-worker";
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

    getChromeAlarmsApi()?.onAlarm.addListener((alarm) => {
      if (!isThreadExpandResumeAlarm(alarm)) {
        return;
      }

      logger.debug("thread_expand.alarm.fired", {
        context: {
          alarmName: alarm.name
        }
      });

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
            url?: string;
            id?: string;
            tab?: {
              id?: number;
            };
          }
        | undefined;

      if (typeof sender === "object" && sender !== null) {
        normalizedSender = {};
        const rawUrl = Reflect.get(sender, "url");

        if (typeof rawUrl === "string") {
          normalizedSender.url = rawUrl;
        }

        const rawId = Reflect.get(sender, "id");

        if (typeof rawId === "string") {
          normalizedSender.id = rawId;
        }

        const rawTab = Reflect.get(sender, "tab");

        if (typeof rawTab === "object" && rawTab !== null) {
          const rawTabId = Reflect.get(rawTab, "id");
          normalizedSender.tab =
            typeof rawTabId === "number" ? { id: rawTabId } : {};
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

