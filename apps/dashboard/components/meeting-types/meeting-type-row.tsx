"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { MeetingType } from "@meeting-system/contracts";

export function MeetingTypeRow({ apiToken, meetingType }: { apiToken: string; meetingType: MeetingType }) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(meetingType.name);
  const [draft, setDraft] = useState(meetingType.name);

  const mutation = useMutation({
    mutationFn: (nextName: string) => api.meetingTypes.update(apiToken, meetingType.id, { name: nextName }),
    onSuccess: (updated) => {
      setName(updated.name);
      setIsEditing(false);
      void queryClient.invalidateQueries({ queryKey: ["meeting-types"] });
    },
  });

  return (
    <li className="flex items-center justify-between gap-4 py-3">
      {isEditing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate(draft);
          }}
          className="flex flex-1 items-center gap-2"
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={100}
            required
            className="flex-1 rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-slate-500 focus:outline-none"
            autoFocus
          />
          <button
            type="submit"
            disabled={mutation.isPending}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft(name);
              setIsEditing(false);
            }}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>
        </form>
      ) : (
        <>
          <div>
            <p className="text-sm font-medium text-slate-900">{name}</p>
            <p className="text-xs text-slate-500">
              {meetingType.roles.length > 0 ? meetingType.roles.map((r) => r.nameSnapshot).join(", ") : "No expected roles"}
            </p>
          </div>
          <button type="button" onClick={() => setIsEditing(true)} className="text-sm font-medium text-slate-500 hover:underline">
            Rename
          </button>
        </>
      )}
      {mutation.isError && <span className="text-xs text-red-600">Failed to save.</span>}
    </li>
  );
}
