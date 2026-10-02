"use client";

import { useEffect, useRef, useState } from "react";
import type { WakeStatus } from "@/lib/wake";

const POLL_MS = 5_000;
const GIVE_UP_MS = 3 * 60_000;

type Phase = "idle" | "waking" | "ready" | "timeout";

export function WakeButton() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [status, setStatus] = useState<WakeStatus>({ bot: false, api: false });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  async function wake() {
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
      if (next.bot && next.api) return setPhase("ready");
      if (Date.now() - startedAt > GIVE_UP_MS) return setPhase("timeout");
      timer.current = setTimeout(poll, POLL_MS);
    };

    await poll();
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={wake}
        disabled={phase === "waking"}
        className="rounded-md bg-slate-900 px-4 py-2 text-white disabled:opacity-60"
      >
        {phase === "waking" ? "Waking…" : "Wake bot"}
      </button>

      {phase !== "idle" && (
        <ul className="text-sm">
          <li>Bot: {status.bot ? "online" : "starting…"}</li>
          <li>API: {status.api ? "online" : "starting…"}</li>
        </ul>
      )}

      {phase === "ready" && <p className="font-medium text-green-700">Ready — you can run /start-meeting in Discord.</p>}
      {phase === "timeout" && (
        <p className="font-medium text-red-700">Still not responding after 3 minutes. Check the Render dashboard.</p>
      )}
    </div>
  );
}
