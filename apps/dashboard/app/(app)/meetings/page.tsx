import Link from "next/link";
import type { MeetingStatus } from "@meeting-system/contracts";
import { auth } from "@/auth";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateTime } from "@/lib/format";

const STATUS_FILTERS: { label: string; value: MeetingStatus | undefined }[] = [
  { label: "All", value: undefined },
  { label: "Active", value: "ACTIVE" },
  { label: "Paused", value: "PAUSED" },
  { label: "Completed", value: "COMPLETED" },
  { label: "Cancelled", value: "CANCELLED" },
];

export default async function MeetingsPage({
  searchParams,
}: {
  searchParams: { status?: string; page?: string };
}) {
  const session = await auth();
  if (!session) return null;

  const status = STATUS_FILTERS.some((f) => f.value === searchParams.status)
    ? (searchParams.status as MeetingStatus | undefined)
    : undefined;
  const page = Math.max(1, Number(searchParams.page) || 1);

  const [meetingsPage, meetingTypes] = await Promise.all([
    api.meetings.list(session.apiToken, session.guildId, status, page),
    api.meetingTypes.list(session.apiToken, session.guildId, false),
  ]);

  const typeNames = Object.fromEntries(meetingTypes.map((type) => [type.id, type.name]));
  const totalPages = Math.max(1, Math.ceil(meetingsPage.total / meetingsPage.pageSize));

  const filterHref = (value: string | undefined) => (value ? `/meetings?status=${value}` : "/meetings");
  const pageHref = (targetPage: number) => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    params.set("page", String(targetPage));
    return `/meetings?${params}`;
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Meetings</h1>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((filter) => (
          <Link
            key={filter.label}
            href={filterHref(filter.value)}
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              status === filter.value
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            {filter.label}
          </Link>
        ))}
      </div>

      <Card>
        {meetingsPage.items.length === 0 ? (
          <EmptyState message="No meetings match this filter." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                  <th className="py-2 pr-4 font-medium">Type</th>
                  <th className="py-2 pr-4 font-medium">Started</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 font-medium">Present</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {meetingsPage.items.map((meeting) => (
                  <tr key={meeting.id} className="hover:bg-slate-50">
                    <td className="py-2 pr-4">
                      <Link href={`/meetings/${meeting.id}`} className="font-medium text-slate-900 hover:underline">
                        {typeNames[meeting.meetingType] ?? "Meeting"}
                      </Link>
                    </td>
                    <td className="py-2 pr-4 text-slate-600">{formatDateTime(meeting.startedAt)}</td>
                    <td className="py-2 pr-4">
                      <StatusBadge status={meeting.status} />
                    </td>
                    <td className="py-2 text-slate-600">
                      {meeting.stats ? `${meeting.stats.presentCount}/${meeting.stats.expectedCount}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between text-sm">
            <Link
              href={pageHref(Math.max(1, page - 1))}
              aria-disabled={page <= 1}
              className={`rounded-md px-3 py-1 ${page <= 1 ? "pointer-events-none text-slate-300" : "text-slate-600 hover:bg-slate-100"}`}
            >
              Previous
            </Link>
            <span className="text-slate-500">
              Page {page} of {totalPages}
            </span>
            <Link
              href={pageHref(Math.min(totalPages, page + 1))}
              aria-disabled={page >= totalPages}
              className={`rounded-md px-3 py-1 ${page >= totalPages ? "pointer-events-none text-slate-300" : "text-slate-600 hover:bg-slate-100"}`}
            >
              Next
            </Link>
          </div>
        )}
      </Card>
    </div>
  );
}
