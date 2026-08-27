import { redirect } from "next/navigation";
import { auth, unstable_update } from "@/auth";

function guildIconUrl(guild: { id: string; icon: string | null }): string | null {
  return guild.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png` : null;
}

export default async function SelectGuildPage() {
  const session = await auth();
  if (!session) {
    redirect("/login");
  }
  // Already resolved (the common single-guild case skips this page entirely
  // in auth.ts's jwt callback) — nothing to pick.
  if (session.guildId) {
    redirect("/");
  }

  const guilds = session.availableGuilds;

  return (
    <main className="mx-auto mt-16 max-w-md space-y-4 px-4">
      <h1 className="text-xl font-semibold text-slate-900">Select a server</h1>

      {guilds.length === 0 ? (
        <p className="text-sm text-slate-600">
          This bot isn&apos;t installed in any server you&apos;re a member of. Ask a server admin to invite it, then
          sign in again.
        </p>
      ) : (
        <ul className="divide-y divide-slate-200 rounded-md border border-slate-200">
          {guilds.map((guild) => (
            <li key={guild.id}>
              <form
                action={async () => {
                  "use server";
                  await unstable_update({ guildId: guild.id });
                  redirect("/");
                }}
              >
                <button
                  type="submit"
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-slate-900 hover:bg-slate-50"
                >
                  {guildIconUrl(guild) ? (
                    <img src={guildIconUrl(guild)!} alt="" className="h-8 w-8 rounded-full" />
                  ) : (
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">
                      {guild.name.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  {guild.name}
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
