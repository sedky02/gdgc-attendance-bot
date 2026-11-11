import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.spec.ts", "scripts/**/*.spec.ts"],
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
