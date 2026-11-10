import { describe, expect, it } from "vitest";
import { validateEnv } from "./env.validation.js";

const required = {
  MONGODB_URI: "mongodb://localhost:27017/meetings",
  JWT_SECRET: "a".repeat(32),
  BOT_SERVICE_TOKEN: "b".repeat(32),
  CORS_ORIGIN: "http://localhost:3000",
};

describe("validateEnv", () => {
  it("accepts the blank optional lines a copied .env.example produces", () => {
    const env = validateEnv({ ...required, SWAGGER_ENABLED: "", BOT_HEALTH_URL: "", API_PUBLIC_URL: "" });

    expect(env.SWAGGER_ENABLED).toBe(true);
    expect(env.BOT_HEALTH_URL).toBeUndefined();
    expect(env.API_PUBLIC_URL).toBeUndefined();
  });

  it("defaults Swagger off in production and honours an explicit override", () => {
    expect(validateEnv({ ...required, NODE_ENV: "production" }).SWAGGER_ENABLED).toBe(false);
    expect(validateEnv({ ...required, NODE_ENV: "production", SWAGGER_ENABLED: "true" }).SWAGGER_ENABLED).toBe(true);
    expect(validateEnv({ ...required, SWAGGER_ENABLED: "false" }).SWAGGER_ENABLED).toBe(false);
  });

  it("rejects a secret shorter than 32 characters", () => {
    expect(() => validateEnv({ ...required, JWT_SECRET: "short" })).toThrow(/JWT_SECRET/);
  });
});
