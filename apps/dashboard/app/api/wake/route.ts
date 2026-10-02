import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createCachedPinger, pingServices } from "@/lib/wake";

// Always evaluated per request, never statically cached.
export const dynamic = "force-dynamic";

// Signed-in users only. Repeated calls inside the cache window share one
// upstream ping (per serverless instance).
const pingOnce = createCachedPinger(() =>
  pingServices({ bot: process.env.BOT_HEALTH_URL, api: process.env.API_HEALTH_URL }),
);

export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await pingOnce());
}
