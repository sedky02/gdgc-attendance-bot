import { describe, expect, it, vi } from "vitest";

vi.mock("./config.js", () => ({ env: { RECONCILE_INTERVAL_MS: 60000 } }));
vi.mock("./logger.js", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("./services/api-client.js", () => ({ apiClient: {} }));
vi.mock("./services/roster-message.js", () => ({ refreshRosterMessage: vi.fn(), untrackRosterMessage: vi.fn() }));

import { enqueue } from "./services/event-queue.js";
import { shutdown } from "./shutdown.js";

describe("shutdown", () => {
  it("delivers queued voice events before disconnecting from Discord", async () => {
    const order: string[] = [];
    const client = { destroy: vi.fn(async () => void order.push("destroy")) };
    const healthServer = { close: vi.fn(() => order.push("close")) };

    enqueue("user-1", async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      order.push("event-1");
    });
    enqueue("user-1", async () => void order.push("event-2"));
    enqueue("user-2", async () => {
      throw new Error("API unreachable");
    });

    await shutdown(client as never, healthServer as never);

    expect(order).toEqual(["event-1", "event-2", "destroy", "close"]);
  });
});
