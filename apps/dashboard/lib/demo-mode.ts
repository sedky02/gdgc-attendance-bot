export const DEMO_PROVIDER_ID = "demo";

// Demo sign-in skips Discord entirely, so it must never be reachable from a production build.
export function isDemoMode(env: Record<string, string | undefined> = process.env): boolean {
  return env.DEMO_MODE === "true" && env.NODE_ENV !== "production";
}
