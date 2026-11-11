import { describe, expect, it } from "vitest";
import { parseServerEnv } from "./server-env.js";

const secret = "s".repeat(32);
const discord = { DISCORD_CLIENT_ID: "id", DISCORD_CLIENT_SECRET: "secret", DISCORD_BOT_TOKEN: "token" };

describe("parseServerEnv", () => {
  it("accepts a complete configuration", () => {
    expect(parseServerEnv({ API_JWT_SECRET: secret, ...discord })).toEqual({
      API_JWT_SECRET: secret,
      DISCORD_BOT_TOKEN: "token",
    });
  });

  it("names every missing variable instead of failing later with an opaque error", () => {
    expect(() => parseServerEnv({ DISCORD_CLIENT_ID: "id" })).toThrow(
      /API_JWT_SECRET.*DISCORD_CLIENT_SECRET.*DISCORD_BOT_TOKEN/,
    );
  });

  it("rejects an API_JWT_SECRET too short for the API to accept", () => {
    expect(() => parseServerEnv({ API_JWT_SECRET: "short", ...discord })).toThrow(/API_JWT_SECRET/);
  });

  it("does not require Discord credentials in demo mode", () => {
    expect(parseServerEnv({ API_JWT_SECRET: secret, DEMO_MODE: "true", NODE_ENV: "development" })).toEqual({
      API_JWT_SECRET: secret,
      DISCORD_BOT_TOKEN: "",
    });
  });

  it("still requires Discord credentials when DEMO_MODE is set on a production build", () => {
    expect(() => parseServerEnv({ API_JWT_SECRET: secret, DEMO_MODE: "true", NODE_ENV: "production" })).toThrow(
      /DISCORD_CLIENT_ID/,
    );
  });
});
