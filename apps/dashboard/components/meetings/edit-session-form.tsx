"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function EditSessionForm({
  apiToken,
  attendanceId,
  meetingId,
  editorName,
  initialJoinedAt,
  initialLeftAt,
  onDone,
}: {
  apiToken: string;
  attendanceId: string;
  meetingId: string;
  editorName: string;
  initialJoinedAt: Date;
  initialLeftAt: Date | null;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const [joinedAt, setJoinedAt] = useState(toLocalInputValue(initialJoinedAt));
  const [leftAt, setLeftAt] = useState(initialLeftAt ? toLocalInputValue(initialLeftAt) : "");

  const mutation = useMutation({
    mutationFn: () =>
      api.attendance.update(apiToken, attendanceId, {
        sessions: [{ joinedAt: new Date(joinedAt), leftAt: leftAt ? new Date(leftAt) : null, source: "MANUAL" }],
        editedBy: editorName,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["meeting-report", meetingId] });
      onDone();
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
      className="flex flex-wrap items-end gap-2 rounded-md border border-slate-200 bg-slate-50 p-2"
    >
      <label className="text-xs text-slate-600">
        Joined
        <input
          type="datetime-local"
          value={joinedAt}
          onChange={(e) => setJoinedAt(e.target.value)}
          required
          className="mt-0.5 block rounded border border-slate-300 px-2 py-1 text-sm"
        />
      </label>
      <label className="text-xs text-slate-600">
        Left
        <input
          type="datetime-local"
          value={leftAt}
          onChange={(e) => setLeftAt(e.target.value)}
          className="mt-0.5 block rounded border border-slate-300 px-2 py-1 text-sm"
        />
      </label>
      <button
        type="submit"
        disabled={mutation.isPending}
        className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
      >
        Save
      </button>
      <button type="button" onClick={onDone} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">
        Cancel
      </button>
      {mutation.isError && <span className="text-xs text-red-600">Failed to save.</span>}
    </form>
  );
}
