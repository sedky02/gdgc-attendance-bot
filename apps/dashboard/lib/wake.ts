export interface WakeStatus {
  bot: boolean;
  api: boolean;
}

const PING_TIMEOUT_MS = 8_000;
/** Repeated clicks or polls inside this window reuse the last result instead of hitting the services again. */
export const WAKE_CACHE_MS = 5_000;

type FetchLike = (url: string, init: { signal: AbortSignal }) => Promise<{ ok: boolean }>;

async function isUp(url: string | undefined, fetchImpl: FetchLike): Promise<boolean> {
  if (!url) return false;
  try {
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(PING_TIMEOUT_MS) });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Sends one request to each service. On Render's free tier that request is
 * what wakes a suspended service; the response (or timeout) tells the caller
 * whether it is up yet.
 */
export async function pingServices(
  urls: { bot: string | undefined; api: string | undefined },
  fetchImpl: FetchLike = fetch,
): Promise<WakeStatus> {
  const [bot, api] = await Promise.all([isUp(urls.bot, fetchImpl), isUp(urls.api, fetchImpl)]);
  return { bot, api };
}

export function createCachedPinger(
  ping: () => Promise<WakeStatus>,
  now: () => number = Date.now,
): () => Promise<WakeStatus> {
  let last: { at: number; result: Promise<WakeStatus> } | null = null;
  return () => {
    if (last && now() - last.at < WAKE_CACHE_MS) return last.result;
    const result = ping();
    last = { at: now(), result };
    return result;
  };
}
