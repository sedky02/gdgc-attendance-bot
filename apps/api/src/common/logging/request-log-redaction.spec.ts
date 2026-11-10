import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { pinoHttp } from "pino-http";
import { REDACTED_REQUEST_LOG_PATHS } from "./request-log-redaction.js";

describe("request log redaction", () => {
  it("never writes the service token, bearer token, or cookies to the request log", async () => {
    const lines: string[] = [];
    const sink = new Writable({
      write(chunk: Buffer, _encoding, callback) {
        lines.push(chunk.toString());
        callback();
      },
    });
    const httpLogger = pinoHttp({ redact: REDACTED_REQUEST_LOG_PATHS }, sink);

    const server = createServer((req, res) => {
      httpLogger(req, res);
      res.end("ok");
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const { port } = server.address() as AddressInfo;

    await fetch(`http://127.0.0.1:${port}/api/v1/meetings`, {
      headers: {
        "X-Service-Token": "service-token-secret",
        Authorization: "Bearer jwt-secret",
        Cookie: "session=cookie-secret",
      },
    });
    await new Promise<void>((resolve) => server.close(() => resolve()));

    const output = lines.join("");
    expect(output).toContain("request completed");
    expect(output).not.toContain("service-token-secret");
    expect(output).not.toContain("jwt-secret");
    expect(output).not.toContain("cookie-secret");
  });
});
