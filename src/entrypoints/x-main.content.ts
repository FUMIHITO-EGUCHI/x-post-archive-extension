import { installGraphqlVideoResponseObserver } from "../features/x/install-graphql-video-response-observer";
import { installQuotedPostContainerAnnotator } from "../features/x/annotate-quoted-post-containers";

export default defineContentScript({
  matches: ["https://x.com/*", "https://twitter.com/*"],
  runAt: "document_start",
  world: "MAIN",
  main() {
    installGraphqlVideoResponseObserver();
    installQuotedPostContainerAnnotator();
  }
});
