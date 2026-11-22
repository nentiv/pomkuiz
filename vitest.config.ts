import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      "apps/*",
      "packages/*",
      { test: { name: "repository", include: ["tests/**/*.test.ts"], environment: "node" } },
    ],
  },
});
