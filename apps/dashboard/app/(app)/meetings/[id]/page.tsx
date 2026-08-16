import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { api, ApiError } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { SummaryEditor } from "@/components/meetings/summary-editor";
import { AttendanceTable } from "@/components/meetings/attendance-table";
import { formatDateTime, formatDuration, formatTime } from "@/lib/format";

export default async function MeetingDetailPage({ params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return null;

  const meeting = await api.meetings.getById(session.apiToken, params.id).catch((error) => {
    if (error instanceof ApiError && (error.status === 404 || error.status === 403)) {
      return null;
    }
    throw error;
  });
  if (!meeting) {
    notFound();
  }

  const meetingType = await api.meetingTypes.get(session.apiToken, meeting.meetingType).catch(() => null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{meetingType?.name ?? "Meeting"}</h1>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-slate-500">
          <span>
            {formatDateTime(meeting.startedAt)} → {meeting.endedAt ? formatTime(meeting.endedAt) : "ongoing"}
            {meeting.stats && ` (${formatDuration(meeting.stats.durationMs)})`}
          </span>
          <StatusBadge status={meeting.status} />
        </div>
      </div>

      {meeting.stats && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <p className="text-xs font-medium uppercase text-slate-500">Present</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">
              {meeting.stats.presentCount}/{meeting.stats.expectedCount}
            </p>
          </Card>
          <Card>
            <p className="text-xs font-medium uppercase text-slate-500">Unexpected</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{meeting.stats.unexpectedCount}</p>
          </Card>
          <Card>
            <p className="text-xs font-medium uppercase text-slate-500">Duration</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{formatDuration(meeting.stats.durationMs)}</p>
          </Card>
        </div>
      )}

      <Card>
        <h2 className="mb-2 text-sm font-semibold text-slate-900">Summary</h2>
        <SummaryEditor
          apiToken={session.apiToken}
          meetingId={meeting.id}
          initialSummary={meeting.summary}
          initialUpdatedBy={meeting.summaryUpdatedBy}
          editorName={session.user.username}
        />
      </Card>

      <Card>
        <AttendanceTable apiToken={session.apiToken} meetingId={meeting.id} editorName={session.user.username} />
      </Card>
    </div>
  );
}
