import { ConflictException } from "@nestjs/common";

interface MongoDuplicateKeyError {
  code: number;
  keyPattern?: Record<string, unknown>;
}

function isDuplicateKeyError(error: unknown): error is MongoDuplicateKeyError {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === 11000;
}

/**
 * Services call this from a write's catch block. A duplicate-key error means
 * a database invariant (unique index) was violated by concurrent writers —
 * that's a conflict the caller can act on, not a server fault, so it must
 * surface as 409 rather than the generic 500 the global filter would give it.
 */
export function translateMongoWriteError(error: unknown): never {
  if (isDuplicateKeyError(error)) {
    const fields = error.keyPattern ? Object.keys(error.keyPattern).join(", ") : "resource";
    throw new ConflictException(`A record with this ${fields} already exists`);
  }
  throw error;
}
