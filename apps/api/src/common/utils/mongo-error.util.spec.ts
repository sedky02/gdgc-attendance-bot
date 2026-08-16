import { describe, expect, it } from "vitest";
import { ConflictException } from "@nestjs/common";
import { translateMongoWriteError } from "./mongo-error.util.js";

describe("translateMongoWriteError", () => {
  it("maps a MongoDB duplicate-key error (11000) to a ConflictException", () => {
    const mongoError = { code: 11000, keyPattern: { meeting: 1, discordUserId: 1 } };

    expect(() => translateMongoWriteError(mongoError)).toThrow(ConflictException);
  });

  it("rethrows anything that isn't a duplicate-key error", () => {
    const other = new Error("connection reset");

    expect(() => translateMongoWriteError(other)).toThrow(other);
  });
});
