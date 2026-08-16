import { logger } from "../logger.js";

// Bounded so a prolonged API outage can't grow this without limit — events
// for one user must stay ordered relative to each other (a join must not be
// applied after a later leave), but a user who's been queuing for this long
// is better served by the next reconciler sync than by a huge backlog replay.
const MAX_QUEUE_LENGTH_PER_USER = 20;

const queues = new Map<string, Promise<void>>();
const queueLengths = new Map<string, number>();

export function enqueue(userId: string, task: () => Promise<void>): void {
  const currentLength = queueLengths.get(userId) ?? 0;
  if (currentLength >= MAX_QUEUE_LENGTH_PER_USER) {
    logger.warn({ userId, queueLength: currentLength }, "Event queue full for user, dropping event");
    return;
  }

  queueLengths.set(userId, currentLength + 1);
  const previous = queues.get(userId) ?? Promise.resolve();

  const next = previous
    .catch(() => undefined)
    .then(task)
    .catch((error: unknown) => {
      logger.error({ err: error, userId }, "Queued voice event failed");
    })
    .finally(() => {
      queueLengths.set(userId, (queueLengths.get(userId) ?? 1) - 1);
    });

  queues.set(userId, next);
}
