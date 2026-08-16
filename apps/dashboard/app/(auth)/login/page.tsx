import { signIn } from "@/auth";

export default function LoginPage() {
  return (
    <main>
      <h1>Meeting System</h1>
      <form
        action={async () => {
          "use server";
          await signIn("discord", { redirectTo: "/" });
        }}
      >
        <button type="submit">Sign in with Discord</button>
      </form>
    </main>
  );
}
