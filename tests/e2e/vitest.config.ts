import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.spec.ts"],
    testTimeout: 60000,
    hookTimeout: 60000,
    env: {
      DISCORD_TOKEN: "unused-by-the-fake-gateway",
      DISCORD_APPLICATION_ID: "unused-by-the-fake-gateway",
    },
  },
});
