import { describe, expect, it } from "vitest";
import { isDemoMode } from "./demo-mode.js";

describe("isDemoMode", () => {
  it("is on only when DEMO_MODE is exactly 'true'", () => {
    expect(isDemoMode({ DEMO_MODE: "true", NODE_ENV: "development" })).toBe(true);
    expect(isDemoMode({ DEMO_MODE: "1", NODE_ENV: "development" })).toBe(false);
    expect(isDemoMode({ NODE_ENV: "development" })).toBe(false);
  });

  it("is always off in a production build, even if DEMO_MODE is set", () => {
    expect(isDemoMode({ DEMO_MODE: "true", NODE_ENV: "production" })).toBe(false);
  });
});
