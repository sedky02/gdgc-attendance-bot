"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDuration, formatTime } from "@/lib/format";
import { EditSessionForm } from "./edit-session-form";
import { AddAttendeeForm } from "./add-attendee-form";

export function AttendanceTable({
  apiToken,
  meetingId,
  editorName,
}: {
  apiToken: string;
  meetingId: string;
  editorName: string;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addingUserId, setAddingUserId] = useState<string | null>(null);

  const reportQuery = useQuery({
    queryKey: ["meeting-report", meetingId],
    queryFn: () => api.meetings.getReport(apiToken, meetingId),
  });

  if (reportQuery.isLoading) {
    return <p className="text-sm text-slate-500">Loading attendance…</p>;
  }
  if (reportQuery.isError || !reportQuery.data) {
    return <p className="text-sm text-red-600">Couldn&apos;t load attendance.</p>;
  }

  const { attendance, absentees } = reportQuery.data;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-900">Attendance</h2>
        {attendance.length === 0 ? (
          <EmptyState message="Nobody has attended yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                  <th className="py-2 pr-4 font-medium">Member</th>
                  <th className="py-2 pr-4 font-medium">First join</th>
                  <th className="py-2 pr-4 font-medium">Duration</th>
                  <th className="py-2 pr-4 font-medium">Sessions</th>
                  <th className="py-2 pr-4 font-medium">Late</th>
                  <th className="py-2 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {attendance.map((a) => (
                  <>
                    <tr key={a.id} className="hover:bg-slate-50">
                      <td className="py-2 pr-4 font-medium text-slate-900">
                        {a.displayNameSnapshot}
                        {!a.expected && (
                          <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">unexpected</span>
                        )}
                        {a.manuallyEdited && (
                          <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                            edited by {a.editedBy}
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-4 text-slate-600">{a.stats ? formatTime(a.stats.firstJoinedAt) : "—"}</td>
                      <td className="py-2 pr-4 text-slate-600">{a.stats ? formatDuration(a.stats.totalDurationMs) : "—"}</td>
                      <td className="py-2 pr-4 text-slate-600">{a.stats?.sessionCount ?? a.sessions.length}</td>
                      <td className="py-2 pr-4 text-slate-600">
                        {a.stats && a.stats.latenessMs > 0 ? formatDuration(a.stats.latenessMs) : "—"}
                      </td>
                      <td className="py-2 text-right">
                        <button
                          type="button"
                          onClick={() => setEditingId(editingId === a.id ? null : a.id)}
                          className="text-xs font-medium text-slate-500 hover:underline"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                    {editingId === a.id && (
                      <tr>
                        <td colSpan={6} className="pb-2">
                          <EditSessionForm
                            apiToken={apiToken}
                            attendanceId={a.id}
                            meetingId={meetingId}
                            editorName={editorName}
                            initialJoinedAt={a.sessions[0]?.joinedAt ?? new Date()}
                            initialLeftAt={a.sessions[a.sessions.length - 1]?.leftAt ?? null}
                            onDone={() => setEditingId(null)}
                          />
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-900">Absentees</h2>
        {absentees.length === 0 ? (
          <EmptyState message="Everyone expected showed up." />
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {absentees.map((absentee) => (
              <li key={absentee.discordUserId} className="py-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-700">{absentee.usernameSnapshot}</span>
                  <button
                    type="button"
                    onClick={() => setAddingUserId(addingUserId === absentee.discordUserId ? null : absentee.discordUserId)}
                    className="text-xs font-medium text-slate-500 hover:underline"
                  >
                    Add attendance
                  </button>
                </div>
                {addingUserId === absentee.discordUserId && (
                  <div className="mt-2">
                    <AddAttendeeForm
                      apiToken={apiToken}
                      meetingId={meetingId}
                      editorName={editorName}
                      discordUserId={absentee.discordUserId}
                      usernameSnapshot={absentee.usernameSnapshot}
                      onDone={() => setAddingUserId(null)}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
