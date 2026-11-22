import { resolve } from "node:path";
import { preact } from "@preact/preset-vite";
import { defineConfig } from "vite";

const BACKOFFICE_ROOT = import.meta.dirname;

export default defineConfig({
  root: resolve(BACKOFFICE_ROOT, "ui"),
  base: "/",
  plugins: [preact()],
  publicDir: false,
  build: {
    outDir: resolve(BACKOFFICE_ROOT, "dist"),
    emptyOutDir: true,
    sourcemap: false,
    assetsInlineLimit: 0,
  },
});
