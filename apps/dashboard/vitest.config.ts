import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["**/*.spec.ts", "**/*.spec.tsx"],
    exclude: ["node_modules", ".next"],
  },
});
