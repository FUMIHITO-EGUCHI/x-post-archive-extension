import { defineConfig } from "wxt";

export default defineConfig({
  srcDir: "src",
  publicDir: "src/public",
  modules: ["@wxt-dev/module-react"],
  manifestVersion: 3,
  manifest: {
    name: "__MSG_extension_name__",
    description: "__MSG_extension_description__",
    default_locale: "en",
    permissions: ["storage", "unlimitedStorage", "cookies", "alarms"], // cookies: ct0 CSRF token retrieval for TweetDetail GraphQL
    host_permissions: [
      "https://x.com/*",
      "https://twitter.com/*",
      "https://pbs.twimg.com/*",
      "https://video.twimg.com/*"
    ],
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';"
    },
    icons: {
      16: "icon/16.png",
      32: "icon/32.png",
      48: "icon/48.png",
      128: "icon/128.png"
    },
    action: {
      default_title: "__MSG_action_title__",
      default_icon: {
        16: "icon/16.png",
        32: "icon/32.png",
        48: "icon/48.png",
        128: "icon/128.png"
      }
    }
  }
});

