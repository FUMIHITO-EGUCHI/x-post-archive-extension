declare namespace chrome {
  namespace runtime {
    function getURL(path: string): string;
    function sendMessage(message: unknown): Promise<unknown>;

    namespace onInstalled {
      function addListener(callback: () => void): void;
    }

    namespace onMessage {
      type SendResponse = (response?: unknown) => void;

      function addListener(
        callback: (
          message: unknown,
          sender: unknown,
          sendResponse: SendResponse
        ) => boolean | void
      ): void;
    }
  }

  namespace tabs {
    function create(createProperties: { url: string }): Promise<unknown>;
  }

  namespace action {
    namespace onClicked {
      function addListener(callback: () => void): void;
    }
  }
}
