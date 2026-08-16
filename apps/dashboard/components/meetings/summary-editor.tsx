"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Meeting } from "@meeting-system/contracts";

export function SummaryEditor({
  apiToken,
  meetingId,
  initialSummary,
  initialUpdatedBy,
  editorName,
}: {
  apiToken: string;
  meetingId: string;
  initialSummary: string | null;
  initialUpdatedBy: string | null;
  editorName: string;
}) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(initialSummary ?? "");
  const [summary, setSummary] = useState(initialSummary);
  const [updatedBy, setUpdatedBy] = useState(initialUpdatedBy);

  const mutation = useMutation({
    mutationFn: (nextSummary: string) =>
      api.meetings.updateSummary(apiToken, meetingId, {
        summary: nextSummary,
        summaryUpdatedBy: editorName,
        observedAt: new Date(),
      }),
    onMutate: async (nextSummary) => {
      // Optimistic: show the new summary and editor immediately.
      setSummary(nextSummary);
      setUpdatedBy(editorName);
      setIsEditing(false);
    },
    onSuccess: (updated: Meeting) => {
      setSummary(updated.summary);
      setUpdatedBy(updated.summaryUpdatedBy);
      void queryClient.invalidateQueries({ queryKey: ["meeting", meetingId] });
    },
    onError: () => {
      // Roll back to the last known-good values.
      setSummary(initialSummary);
      setUpdatedBy(initialUpdatedBy);
    },
  });

  if (isEditing) {
    return (
      <div className="space-y-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={4}
          maxLength={4000}
          className="w-full rounded-md border border-slate-300 p-2 text-sm focus:border-slate-500 focus:outline-none"
          autoFocus
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => mutation.mutate(draft)}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft(summary ?? "");
              setIsEditing(false);
            }}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {summary ? <p className="whitespace-pre-wrap text-sm text-slate-700">{summary}</p> : <p className="text-sm text-slate-400">No summary yet.</p>}
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            setDraft(summary ?? "");
            setIsEditing(true);
          }}
          className="text-sm font-medium text-slate-600 hover:underline"
        >
          {summary ? "Edit summary" : "Add summary"}
        </button>
        {updatedBy && <span className="text-xs text-slate-400">last edited by {updatedBy}</span>}
        {mutation.isError && <span className="text-xs text-red-600">Failed to save — try again.</span>}
      </div>
    </div>
  );
}
