import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.spec.ts"],
    env: {
      DISCORD_TOKEN: "test-token",
      DISCORD_APPLICATION_ID: "test-app-id",
      API_BASE_URL: "http://localhost:3001/api/v1",
      BOT_SERVICE_TOKEN: "test-service-token",
    },
  },
});
