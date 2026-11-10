import type { JwtPayload } from "../../auth/jwt-payload.js";

// A dashboard caller's identity comes from its signed JWT. Only the bot,
// authenticated by the service token and carrying no JWT, may name the actor itself.
export function trustedActor(user: JwtPayload | undefined, claimedActor: string): string {
  return user ? user.username : claimedActor;
}
