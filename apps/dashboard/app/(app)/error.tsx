"use client";

import { useEffect } from "react";
import { BotStatusCard } from "@/components/bot/bot-status-card";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  // The API is asleep far more often than it is broken, and waking it is the
  // fix — so keep the wake control reachable from the error state.
  return (
    <div className="space-y-4">
      <BotStatusCard />
      <div className="flex flex-col items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-6">
        <p className="text-sm font-medium text-red-800">Something went wrong loading this page.</p>
        <button
          type="button"
          onClick={reset}
          className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
