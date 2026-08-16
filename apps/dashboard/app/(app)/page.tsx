import { auth } from "@/auth";

export default async function OverviewPage() {
  const session = await auth();

  return (
    <section>
      <h1>Welcome, {session?.user.username}</h1>
      <p>Discord user ID: {session?.user.discordUserId}</p>
    </section>
  );
}
