// Writes the two env files the Discord-free demo needs, with freshly generated
// local secrets. Never overwrites an existing env file.
import { randomBytes } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const jwtSecret = randomBytes(32).toString("base64");

const files = {
  "apps/api/.env": [
    "NODE_ENV=development",
    "PORT=3001",
    "MONGODB_URI=mongodb://root:root@localhost:27017/meetings?authSource=admin",
    `JWT_SECRET=${jwtSecret}`,
    `BOT_SERVICE_TOKEN=${randomBytes(32).toString("hex")}`,
    "CORS_ORIGIN=http://localhost:3000",
  ],
  "apps/dashboard/.env.local": [
    "NEXTAUTH_URL=http://localhost:3000",
    `NEXTAUTH_SECRET=${randomBytes(32).toString("base64")}`,
    "DEMO_MODE=true",
    `API_JWT_SECRET=${jwtSecret}`,
    "NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1",
  ],
};

const existing = Object.keys(files).filter((file) => existsSync(resolve(root, file)));
if (existing.length > 0) {
  console.error(`Refusing to overwrite: ${existing.join(", ")}. Move or delete them, then run this again.`);
  process.exit(1);
}

for (const [file, lines] of Object.entries(files)) {
  writeFileSync(resolve(root, file), `${lines.join("\n")}\n`, { mode: 0o600 });
  console.log(`Wrote ${file}`);
}
console.log("Demo env files are ready. Next: pnpm --filter api seed && pnpm demo");
