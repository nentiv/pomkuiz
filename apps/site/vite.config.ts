import { resolve } from "node:path";
import { preact } from "@preact/preset-vite";
import { defineConfig } from "vitest/config";
import { DATA_LAYOUT } from "@pomkuiz/quiz-contract";
import { contentSecurityPolicyPlugin, publishGuardPlugin, quizDataPlugin } from "./build/vite-plugins.ts";

const OUT_DIR = resolve(import.meta.dirname, "dist");
const DATA_DIRECTORY = resolve(import.meta.dirname, "..", "..", DATA_LAYOUT.publicDirectory);

export default defineConfig({
  base: "./",
  plugins: [
    preact(),
    quizDataPlugin({ dataDirectory: DATA_DIRECTORY }),
    contentSecurityPolicyPlugin(),
    publishGuardPlugin({ outDir: OUT_DIR }),
  ],
  publicDir: false,
  build: {
    outDir: OUT_DIR,
    emptyOutDir: true,
    sourcemap: false,
    assetsInlineLimit: 0,
  },
  server: { host: "127.0.0.1" },
  preview: { host: "127.0.0.1" },
  test: {
    include: ["tests/**/*.test.{ts,tsx}"],
    environment: "node",
  },
});
