import type { JwtPayload } from "../auth/jwt-payload.js";

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}
