import { Card } from "@/components/ui/card";
import { WakeButton } from "./wake-button";

export const metadata = { title: "Wake bot" };

export default function WakePage() {
  return (
    <main className="mx-auto max-w-md p-6">
      <Card className="space-y-4">
        <h1 className="text-xl font-semibold">Wake the attendance bot</h1>
        <p className="text-sm text-slate-600">
          The bot sleeps when idle to save hosting hours. Press the button, wait until both services show online (usually
          30–60 seconds), then run /start-meeting.
        </p>
        <WakeButton />
      </Card>
    </main>
  );
}
