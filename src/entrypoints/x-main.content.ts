import { installGraphqlVideoResponseObserver } from "../features/x/install-graphql-video-response-observer";
import { installQuotedPostContainerAnnotator } from "../features/x/annotate-quoted-post-containers";
import { installLikeBookmarkInterceptor } from "../features/x/intercept-like-bookmark-actions";
import { installTweetDetailTemplateCapture } from "../features/x/install-tweet-detail-template-capture";

export default defineContentScript({
  matches: ["https://x.com/*", "https://twitter.com/*"],
  runAt: "document_start",
  world: "MAIN",
  main() {
    installGraphqlVideoResponseObserver();
    installTweetDetailTemplateCapture();
    installLikeBookmarkInterceptor();
    installQuotedPostContainerAnnotator();
  }
});
