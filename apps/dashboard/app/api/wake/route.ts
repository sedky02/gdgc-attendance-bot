import { NextResponse } from "next/server";
import { createCachedPinger, pingServices } from "@/lib/wake";

// Public on purpose for now (no session required) — see createCachedPinger for
// the only abuse limit. Always evaluated per request, never statically cached.
export const dynamic = "force-dynamic";

const pingOnce = createCachedPinger(() =>
  pingServices({ bot: process.env.BOT_HEALTH_URL, api: process.env.API_HEALTH_URL }),
);

export async function POST() {
  return NextResponse.json(await pingOnce());
}
