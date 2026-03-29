import { bootstrapXContentScript } from "../features/x/bootstrap-x-content-script";

export default defineContentScript({
  matches: ["https://x.com/*", "https://twitter.com/*"],
  runAt: "document_idle",
  main() {
    bootstrapXContentScript();
  }
});

