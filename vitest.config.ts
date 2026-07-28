import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "packages/**/*.test.ts",
      "apps/worker/test/**/*.test.ts",
      "apps/web/src/**/*.test.ts"
    ],
    coverage: {
      reporter: ["text", "html"]
    }
  }
});
