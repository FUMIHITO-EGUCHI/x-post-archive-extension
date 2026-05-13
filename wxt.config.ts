import { defineConfig } from "wxt";

export default defineConfig({
  srcDir: "src",
  publicDir: "src/public",
  modules: ["@wxt-dev/module-react"],
  manifestVersion: 3,
  manifest: {
    name: "X Post Archive Extension",
    description: "Save X posts and review them later in a simple archive viewer.",
    permissions: ["storage", "unlimitedStorage", "cookies", "alarms"], // cookies: ct0 CSRF token retrieval for TweetDetail GraphQL
    host_permissions: [
      "https://x.com/*",
      "https://twitter.com/*",
      "https://pbs.twimg.com/*",
      "https://video.twimg.com/*"
    ],
    icons: {
      16: "icon/16.png",
      32: "icon/32.png",
      48: "icon/48.png",
      128: "icon/128.png"
    },
    action: {
      default_title: "Open archive viewer",
      default_icon: {
        16: "icon/16.png",
        32: "icon/32.png",
        48: "icon/48.png",
        128: "icon/128.png"
      }
    }
  }
});

