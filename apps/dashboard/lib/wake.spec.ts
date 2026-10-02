import { describe, expect, it, vi } from "vitest";
import { createCachedPinger, pingServices, WAKE_CACHE_MS } from "./wake";

describe("pingServices", () => {
  it("reports each service independently", async () => {
    const fetchImpl = vi.fn(async (url: string) => ({ ok: url.includes("bot") }));
    const status = await pingServices({ bot: "https://bot.test", api: "https://api.test" }, fetchImpl);
    expect(status).toEqual({ bot: true, api: false });
  });

  it("treats a thrown error or timeout as not up", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("timeout");
    });
    expect(await pingServices({ bot: "https://bot.test", api: "https://api.test" }, fetchImpl)).toEqual({ bot: false, api: false });
  });

  it("treats a missing URL as not up without making a request", async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true }));
    const status = await pingServices({ bot: undefined, api: "https://api.test" }, fetchImpl);
    expect(status).toEqual({ bot: false, api: true });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe("createCachedPinger", () => {
  it("reuses the last result inside the cache window and refreshes after it", async () => {
    let time = 1_000;
    const ping = vi.fn(async () => ({ bot: true, api: true }));
    const cached = createCachedPinger(ping, () => time);

    await cached();
    time += WAKE_CACHE_MS - 1;
    await cached();
    expect(ping).toHaveBeenCalledTimes(1);

    time += 1;
    await cached();
    expect(ping).toHaveBeenCalledTimes(2);
  });
});
