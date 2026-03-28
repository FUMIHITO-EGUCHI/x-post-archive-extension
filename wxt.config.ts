import { defineConfig } from "wxt";

export default defineConfig({
  srcDir: "src",
  modules: ["@wxt-dev/module-react"],
  manifestVersion: 3,
  manifest: {
    name: "X Post Archive Extension",
    description: "Save X posts and review them later in a simple archive viewer.",
    permissions: ["storage"],
    host_permissions: ["https://x.com/*", "https://twitter.com/*"],
    action: {
      default_title: "Open archive viewer"
    }
  }
});

