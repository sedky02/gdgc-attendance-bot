"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { WakeStatus } from "@/lib/wake";

const POLL_MS = 5_000;
const GIVE_UP_MS = 3 * 60_000;

export type WakePhase = "idle" | "waking" | "ready" | "timeout";

interface WakeContextValue {
  phase: WakePhase;
  status: WakeStatus;
  wake: () => void;
}

const WakeContext = createContext<WakeContextValue | null>(null);

/**
 * Shared by the sidebar button and the overview card so both reflect one
 * wake attempt. There is deliberately no check-on-load: any request to a
 * sleeping Render service wakes it, so merely *looking* at the status would
 * burn instance hours.
 */
export function WakeProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<WakePhase>("idle");
  const [status, setStatus] = useState<WakeStatus>({ bot: false, api: false });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const running = useRef(false);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const wake = useCallback(() => {
    if (running.current) return;
    running.current = true;
    setPhase("waking");
    const startedAt = Date.now();

    const poll = async () => {
      let next: WakeStatus = { bot: false, api: false };
      try {
        const res = await fetch("/api/wake", { method: "POST" });
        if (res.ok) next = (await res.json()) as WakeStatus;
      } catch {
        // network blip — keep polling until the deadline
      }
      setStatus(next);
      if (next.bot && next.api) {
        running.current = false;
        return setPhase("ready");
      }
      if (Date.now() - startedAt > GIVE_UP_MS) {
        running.current = false;
        return setPhase("timeout");
      }
      timer.current = setTimeout(poll, POLL_MS);
    };

    void poll();
  }, []);

  return <WakeContext.Provider value={{ phase, status, wake }}>{children}</WakeContext.Provider>;
}

export function useWake(): WakeContextValue {
  const ctx = useContext(WakeContext);
  if (!ctx) throw new Error("useWake must be used inside <WakeProvider>");
  return ctx;
}
