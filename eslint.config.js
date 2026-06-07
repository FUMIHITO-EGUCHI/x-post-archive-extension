import tsParser from "@typescript-eslint/parser";
import globals from "globals";

const contentSafeFiles = [
  "src/entrypoints/x.content.ts",
  "src/entrypoints/x-main.content.ts",
  "src/features/x/**/*.{ts,tsx}",
  "src/features/runtime/client.ts"
];

const contentSafeImportRestrictions = {
  paths: [
    {
      name: "dexie",
      message:
        "Content-safe modules must not import Dexie directly. Move constants, types, or pure helpers into a Dexie-free module."
    }
  ],
  patterns: [
    {
      regex: "(^|.*/)db/archive-database(\\.[^/]+)?$",
      message:
        "Content-safe modules must not import the Dexie database module. Import only Dexie-free constants, types, or helpers."
    },
    {
      regex: "(^|.*/)db/repositories/.+$",
      message:
        "Content-safe modules must not import Dexie repositories. Route storage access through runtime messages or a Dexie-free helper."
    }
  ]
};

export default [
  {
    ignores: [".output/**", ".wxt/**", "node_modules/**", ".diagnostics/**", ".shared-cdp-profile/**"]
  },
  {
    files: ["**/*.{ts,tsx,mts,cts}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: {
          jsx: true
        }
      },
      globals: {
        ...globals.browser,
        ...globals.es2024,
        ...globals.node,
        browser: "readonly",
        chrome: "readonly"
      }
    }
  },
  {
    files: contentSafeFiles,
    rules: {
      "no-restricted-imports": ["error", contentSafeImportRestrictions]
    }
  },
  {
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.es2024,
        ...globals.node
      }
    }
  }
];
