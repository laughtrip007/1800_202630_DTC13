import { defineConfig } from "vite";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));

// add new pages here so they get built
const pages = [
  "index",
  "login",
  "main",
  "features",
  "profile",
  "link-checker",
  "analyzing",
  "link-result",
  "scam-reports",
  "scam-query",
  "submit-report",
  "community-help",
];

export default defineConfig({
  build: {
    rollupOptions: {
      input: Object.fromEntries(
        pages.map((name) => [name, resolve(root, `${name}.html`)]),
      ),
    },
  },
});
