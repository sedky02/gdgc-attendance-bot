"use client";

import { Card } from "@/components/ui/card";
import { useWake } from "./wake-provider";

function Dot({ up, active }: { up: boolean; active: boolean }) {
  const color = up ? "bg-green-500" : active ? "bg-amber-400" : "bg-slate-300";
  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} />;
}

export function BotStatusCard() {
  const { phase, status, wake } = useWake();
  const waking = phase === "waking";
  const touched = phase !== "idle";

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Bot status</h2>
          <p className="mt-1 text-sm text-slate-500">
            The bot sleeps when idle to save hosting hours. Wake it before a meeting, wait until both show online
            (usually 30–60 seconds), then run /start-meeting.
          </p>
        </div>
        <button
          type="button"
          onClick={wake}
          disabled={waking}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {waking ? "Waking…" : "Wake bot"}
        </button>
      </div>

      <ul className="mt-3 flex gap-6 text-sm text-slate-700">
        <li className="flex items-center gap-2">
          <Dot up={status.bot} active={waking} />
          Bot: {status.bot ? "online" : waking ? "starting…" : touched ? "offline" : "unknown"}
        </li>
        <li className="flex items-center gap-2">
          <Dot up={status.api} active={waking} />
          API: {status.api ? "online" : waking ? "starting…" : touched ? "offline" : "unknown"}
        </li>
      </ul>

      {phase === "ready" && <p className="mt-3 text-sm font-medium text-green-700">Ready — run /start-meeting in Discord.</p>}
      {phase === "timeout" && (
        <p className="mt-3 text-sm font-medium text-red-700">Still not responding after 3 minutes. Check the Render dashboard.</p>
      )}
    </Card>
  );
}
