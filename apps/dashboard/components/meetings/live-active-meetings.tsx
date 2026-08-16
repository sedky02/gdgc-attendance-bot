"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatTime } from "@/lib/format";

const POLL_INTERVAL_MS = 10_000;

export function LiveActiveMeetings({ apiToken, guildId }: { apiToken: string; guildId: string }) {
  const meetingsQuery = useQuery({
    queryKey: ["meetings", "active", guildId],
    queryFn: () => api.meetings.listActive(apiToken, guildId),
    refetchInterval: POLL_INTERVAL_MS,
  });

  const typesQuery = useQuery({
    queryKey: ["meeting-types", guildId],
    queryFn: () => api.meetingTypes.list(apiToken, guildId),
    staleTime: 60_000,
  });

  const typeNames = Object.fromEntries((typesQuery.data ?? []).map((type) => [type.id, type.name]));

  return (
    <Card>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-semibold text-slate-900">Live now</h2>
        <span className="relative flex h-2 w-2">
          <span
            className={`absolute inline-flex h-full w-full rounded-full bg-green-400 ${
              meetingsQuery.isFetching ? "animate-ping opacity-75" : "opacity-0"
            }`}
          />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
        </span>
      </div>

      {meetingsQuery.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : meetingsQuery.isError ? (
        <p className="text-sm text-red-600">Couldn&apos;t load live meetings.</p>
      ) : meetingsQuery.data && meetingsQuery.data.length > 0 ? (
        <ul className="divide-y divide-slate-100">
          {meetingsQuery.data.map((meeting) => (
            <li key={meeting.id} className="flex items-center justify-between py-2">
              <Link href={`/meetings/${meeting.id}`} className="text-sm font-medium text-slate-900 hover:underline">
                {typeNames[meeting.meetingType] ?? "Meeting"}
              </Link>
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span>started {formatTime(meeting.startedAt)}</span>
                <StatusBadge status={meeting.status} />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState message="No meeting is currently live." />
      )}
    </Card>
  );
}
