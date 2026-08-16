import { describe, expect, it } from "vitest";
import { enqueue } from "./event-queue.js";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe("event-queue", () => {
  it("runs tasks for the same user strictly in order", async () => {
    const order: number[] = [];
    const first = deferred<void>();

    enqueue("user-1", async () => {
      await first.promise;
      order.push(1);
    });
    enqueue("user-1", async () => {
      order.push(2);
    });

    // The second task must not run before the first resolves, even though
    // it was enqueued immediately after.
    await new Promise((r) => setTimeout(r, 10));
    expect(order).toEqual([]);

    first.resolve();
    await new Promise((r) => setTimeout(r, 10));
    expect(order).toEqual([1, 2]);
  });

  it("runs tasks for different users independently, without blocking each other", async () => {
    const order: string[] = [];
    const blockUser1 = deferred<void>();

    enqueue("user-a", async () => {
      await blockUser1.promise;
      order.push("a");
    });
    enqueue("user-b", async () => {
      order.push("b");
    });

    await new Promise((r) => setTimeout(r, 10));
    // user-b's task completed even though user-a's is still blocked.
    expect(order).toEqual(["b"]);

    blockUser1.resolve();
    await new Promise((r) => setTimeout(r, 10));
    expect(order).toEqual(["b", "a"]);
  });

  it("a failing task does not break the chain for subsequent tasks", async () => {
    const order: string[] = [];

    enqueue("user-c", async () => {
      throw new Error("boom");
    });
    enqueue("user-c", async () => {
      order.push("after-failure");
    });

    await new Promise((r) => setTimeout(r, 10));
    expect(order).toEqual(["after-failure"]);
  });

  it("drops events once a user's queue reaches its bound", async () => {
    const ran: number[] = [];
    const block = deferred<void>();

    // Fill the queue past its bound with slow tasks, then one more that
    // should be dropped since it can never be reached in time.
    for (let i = 0; i < 25; i++) {
      enqueue("user-d", async () => {
        await block.promise;
        ran.push(i);
      });
    }

    block.resolve();
    await new Promise((r) => setTimeout(r, 20));

    // Fewer than 25 ran — some were dropped by the bound.
    expect(ran.length).toBeLessThan(25);
  });
});
