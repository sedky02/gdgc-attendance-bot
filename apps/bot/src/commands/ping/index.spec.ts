import { describe, expect, it } from "vitest";
import { data } from "./index.js";

describe("/ping command", () => {
  it("registers as a slash command named ping", () => {
    expect(data.toJSON().name).toBe("ping");
  });
});
