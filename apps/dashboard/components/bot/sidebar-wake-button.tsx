"use client";

import { useWake } from "./wake-provider";

export function SidebarWakeButton() {
  const { phase, status, wake } = useWake();
  const waking = phase === "waking";
  const label = waking ? "Waking…" : phase === "ready" ? "Bot online" : "Wake bot";
  const dot = phase === "ready" ? "bg-green-500" : waking ? "bg-amber-400" : "bg-slate-500";

  return (
    <button
      type="button"
      onClick={wake}
      disabled={waking}
      title={`Bot: ${status.bot ? "online" : "—"} · API: ${status.api ? "online" : "—"}`}
      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white disabled:opacity-70"
    >
      <span className={`inline-block h-2 w-2 rounded-full ${dot}`} />
      {label}
    </button>
  );
}
