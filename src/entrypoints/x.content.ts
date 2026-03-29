import { bootstrapXContentScript } from "../features/x/bootstrap-x-content-script";

export default defineContentScript({
  matches: ["https://x.com/*", "https://twitter.com/*"],
  runAt: "document_start",
  main() {
    bootstrapXContentScript();
  }
});

