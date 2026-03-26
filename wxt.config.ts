import { defineConfig } from "wxt";

export default defineConfig({
  srcDir: "src",
  modules: ["@wxt-dev/module-react"],
  manifestVersion: 3,
  manifest: {
    name: "X Post Archive Extension",
    description: "Save and search X posts as personal snapshots.",
    permissions: ["storage"],
    host_permissions: ["https://x.com/*", "https://twitter.com/*"],
    action: {
      default_title: "Open archive viewer",
      default_popup: "popup.html"
    }
  }
});

