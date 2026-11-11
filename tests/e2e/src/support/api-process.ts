import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const API_ENTRY = fileURLToPath(new URL("../../../../apps/api/dist/main.js", import.meta.url));

export const SERVICE_TOKEN = "e2e-service-token-0123456789abcdef";

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, () => {
      const { port } = server.address() as { port: number };
      server.close(() => resolve(port));
    });
  });
}

export interface ApiProcess {
  baseUrl: string;
  stop: () => Promise<void>;
}

/** Runs the built API (`apps/api/dist`) as a real process against the given MongoDB. */
export async function startApi(mongoUri: string): Promise<ApiProcess> {
  const port = await freePort();
  const output: string[] = [];

  const child: ChildProcess = spawn(process.execPath, [API_ENTRY], {
    // An empty working directory, so no developer .env file can leak into the run.
    cwd: mkdtempSync(join(tmpdir(), "meeting-system-e2e-")),
    env: {
      PATH: process.env.PATH,
      NODE_ENV: "test",
      PORT: String(port),
      MONGODB_URI: mongoUri,
      JWT_SECRET: "e2e-jwt-secret-0123456789abcdef-0123",
      BOT_SERVICE_TOKEN: SERVICE_TOKEN,
      CORS_ORIGIN: "http://localhost:3000",
      SWAGGER_ENABLED: "false",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout?.on("data", (chunk: Buffer) => output.push(chunk.toString()));
  child.stderr?.on("data", (chunk: Buffer) => output.push(chunk.toString()));

  const origin = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`API exited with code ${child.exitCode} before becoming healthy:\n${output.join("")}`);
    }
    const healthy = await fetch(`${origin}/health`)
      .then((response) => response.ok)
      .catch(() => false);
    if (healthy) {
      return {
        baseUrl: `${origin}/api/v1`,
        stop: () =>
          new Promise((resolve) => {
            child.once("exit", () => resolve());
            child.kill("SIGTERM");
          }),
      };
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  child.kill("SIGKILL");
  throw new Error(`API did not become healthy within 30s:\n${output.join("")}`);
}
