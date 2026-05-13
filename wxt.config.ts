import { defineConfig } from "wxt";

export default defineConfig({
  srcDir: "src",
  publicDir: "src/public",
  modules: ["@wxt-dev/module-react"],
  manifestVersion: 3,
  manifest: {
    name: "Offline X Archive",
    description: "Save X posts to a fully offline, on-device archive. Browse and search what you saved later, with no account and no servers.",
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

