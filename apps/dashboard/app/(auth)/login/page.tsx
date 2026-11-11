import { signIn } from "@/auth";
import { DEMO_PROVIDER_ID, isDemoMode } from "@/lib/demo-mode";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Meeting System</h1>
        <p className="mt-1 text-sm text-slate-500">Voice-channel attendance for your Discord server.</p>

        <form
          className="mt-6"
          action={async () => {
            "use server";
            await signIn("discord", { redirectTo: "/" });
          }}
        >
          <button
            type="submit"
            className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Sign in with Discord
          </button>
        </form>

        {isDemoMode() && (
          <form
            className="mt-3"
            action={async () => {
              "use server";
              await signIn(DEMO_PROVIDER_ID, { redirectTo: "/" });
            }}
          >
            <button
              type="submit"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Continue with demo data
            </button>
            <p className="mt-2 text-xs text-slate-500">
              Demo mode is on: signs you in as a manager of the seeded demo server, with no Discord account.
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
