import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth, signOut, unstable_update } from "@/auth";
import { SidebarNav } from "@/components/sidebar-nav";
import { QueryProvider } from "../query-provider";
import { WakeProvider } from "@/components/bot/wake-provider";
import { SidebarWakeButton } from "@/components/bot/sidebar-wake-button";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session) {
    redirect("/login");
  }
  if (!session.guildId) {
    redirect("/select-guild");
  }

  return (
    <QueryProvider>
      <WakeProvider>
        <div className="flex min-h-screen flex-col md:flex-row">
          <aside className="flex shrink-0 flex-col justify-between bg-slate-900 p-4 md:w-56 md:min-h-screen">
            <div>
              <div className="mb-6 px-3 text-lg font-semibold text-white">
                Meeting System
              </div>
              <SidebarNav />
              <div className="mt-4 border-t border-slate-800 pt-4">
                <SidebarWakeButton />
              </div>
            </div>
            <div className="mt-6 space-y-2 border-t border-slate-800 pt-4 px-3">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm text-slate-300">
                  {session.user.username}
                </span>
                <form
                  action={async () => {
                    "use server";
                    await signOut({ redirectTo: "/login" });
                  }}
                >
                  <button
                    type="submit"
                    className="text-sm text-slate-400 hover:text-white"
                  >
                    Sign out
                  </button>
                </form>
              </div>
              {session.availableGuilds.length > 1 && (
                <form
                  action={async () => {
                    "use server";
                    await unstable_update({ guildId: "" });
                    redirect("/select-guild");
                  }}
                >
                  <button
                    type="submit"
                    className="text-sm text-slate-400 hover:text-white"
                  >
                    Switch server
                  </button>
                </form>
              )}
            </div>
          </aside>
          <main className="flex-1 bg-slate-50 p-4 md:p-8">{children}</main>
        </div>
      </WakeProvider>
    </QueryProvider>
  );
}
