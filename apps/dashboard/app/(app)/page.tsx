import Link from "next/link";
import { auth } from "@/auth";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LiveActiveMeetings } from "@/components/meetings/live-active-meetings";
import { formatDateTime } from "@/lib/format";

export default async function OverviewPage() {
  const session = await auth();
  if (!session) return null;

  const { apiToken, guildId } = session;

  const [activeMeetings, recentMeetings, meetingTypes] = await Promise.all([
    api.meetings.listActive(apiToken, guildId),
    api.meetings.list(apiToken, guildId, undefined, 1),
    api.meetingTypes.list(apiToken, guildId, false),
  ]);

  const typeNames = Object.fromEntries(meetingTypes.map((type) => [type.id, type.name]));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Overview</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-xs font-medium uppercase text-slate-500">Active now</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{activeMeetings.length}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase text-slate-500">Total meetings</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{recentMeetings.total}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase text-slate-500">Meeting types</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{meetingTypes.length}</p>
        </Card>
      </div>

      <LiveActiveMeetings apiToken={apiToken} guildId={guildId} />

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Recent meetings</h2>
          <Link href="/meetings" className="text-sm text-slate-500 hover:underline">
            View all
          </Link>
        </div>

        {recentMeetings.items.length === 0 ? (
          <EmptyState message="No meetings yet." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {recentMeetings.items.slice(0, 5).map((meeting) => (
              <li key={meeting.id} className="flex items-center justify-between py-2">
                <Link href={`/meetings/${meeting.id}`} className="text-sm font-medium text-slate-900 hover:underline">
                  {typeNames[meeting.meetingType] ?? "Meeting"}
                </Link>
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span>{formatDateTime(meeting.startedAt)}</span>
                  <StatusBadge status={meeting.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
