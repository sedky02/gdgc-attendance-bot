import { auth } from "@/auth";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { MeetingTypeRow } from "@/components/meeting-types/meeting-type-row";

export default async function MeetingTypesPage() {
  const session = await auth();
  if (!session) return null;

  const meetingTypes = await api.meetingTypes.list(session.apiToken, session.guildId, false);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Meeting Types</h1>
        <p className="mt-1 text-sm text-slate-500">
          Created from Discord via /configure-meeting. Roles are managed there — the dashboard can rename a type.
        </p>
      </div>

      <Card>
        {meetingTypes.length === 0 ? (
          <EmptyState message="No meeting types yet — run /configure-meeting in Discord first." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {meetingTypes.map((meetingType) => (
              <MeetingTypeRow key={meetingType.id} apiToken={session.apiToken} meetingType={meetingType} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
