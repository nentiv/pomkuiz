import { preact } from "@preact/preset-vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [preact()],
  test: {
    include: ["tests/**/*.test.ts", "ui/tests/**/*.test.tsx"],
    exclude: ["tests/live/**"],
    environment: "node",
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
