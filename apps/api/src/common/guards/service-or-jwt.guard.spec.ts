import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { Reflector } from "@nestjs/core";
import { ForbiddenException, UnauthorizedException, type ExecutionContext } from "@nestjs/common";
import { ServiceOrJwtGuard } from "./service-or-jwt.guard.js";
import { RESOURCE_TYPE_KEY, type ResourceTypeValue } from "../decorators/resource-type.decorator.js";

const BOT_SERVICE_TOKEN = "the-bot-token";
const JWT_PAYLOAD = { discordUserId: "user-1", username: "aymen", guildId: "guild-1", roleIds: [] };

function fakeConfig() {
  return { get: (key: string) => (key === "BOT_SERVICE_TOKEN" ? BOT_SERVICE_TOKEN : "unused") } as never;
}

function fakeRequest(overrides: {
  serviceToken?: string;
  bearer?: string;
  params?: Record<string, string>;
  query?: Record<string, string>;
  body?: Record<string, unknown>;
}) {
  const headers: Record<string, string> = {};
  if (overrides.serviceToken) headers["x-service-token"] = overrides.serviceToken;
  if (overrides.bearer) headers.authorization = `Bearer ${overrides.bearer}`;

  return {
    header: (name: string) => headers[name.toLowerCase()],
    params: overrides.params ?? {},
    query: overrides.query ?? {},
    body: overrides.body ?? {},
  };
}

function makeContext(request: unknown, resourceType?: ResourceTypeValue) {
  const handler = function exampleHandler() {};
  if (resourceType) {
    Reflect.defineMetadata(RESOURCE_TYPE_KEY, resourceType, handler);
  }
  class ExampleController {}

  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => handler,
    getClass: () => ExampleController,
  } as unknown as ExecutionContext;
}

describe("ServiceOrJwtGuard", () => {
  it("allows a request with a valid service token, regardless of guild", async () => {
    const guard = new ServiceOrJwtGuard(fakeConfig(), { verifyAsync: vi.fn() } as never, new Reflector(), {
      resolveOwnerGuildId: vi.fn(),
    } as never);

    const context = makeContext(fakeRequest({ serviceToken: BOT_SERVICE_TOKEN, query: { guildId: "some-other-guild" } }));
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it("rejects a request with neither a service token nor a bearer token", async () => {
    const guard = new ServiceOrJwtGuard(fakeConfig(), { verifyAsync: vi.fn() } as never, new Reflector(), {
      resolveOwnerGuildId: vi.fn(),
    } as never);

    const context = makeContext(fakeRequest({}));
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rejects an invalid or expired bearer token", async () => {
    const jwtService = { verifyAsync: vi.fn().mockRejectedValue(new Error("expired")) };
    const guard = new ServiceOrJwtGuard(fakeConfig(), jwtService as never, new Reflector(), {
      resolveOwnerGuildId: vi.fn(),
    } as never);

    const context = makeContext(fakeRequest({ bearer: "bad-token" }));
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("allows a valid bearer token whose guildId query param matches the JWT's guild", async () => {
    const jwtService = { verifyAsync: vi.fn().mockResolvedValue(JWT_PAYLOAD) };
    const guard = new ServiceOrJwtGuard(fakeConfig(), jwtService as never, new Reflector(), {
      resolveOwnerGuildId: vi.fn(),
    } as never);

    const context = makeContext(fakeRequest({ bearer: "good-token", query: { guildId: "guild-1" } }));
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it("rejects a valid bearer token whose guildId query param names a different guild", async () => {
    const jwtService = { verifyAsync: vi.fn().mockResolvedValue(JWT_PAYLOAD) };
    const guard = new ServiceOrJwtGuard(fakeConfig(), jwtService as never, new Reflector(), {
      resolveOwnerGuildId: vi.fn(),
    } as never);

    const context = makeContext(fakeRequest({ bearer: "good-token", query: { guildId: "guild-2" } }));
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejects a meeting-id-scoped route when the meeting belongs to a different guild", async () => {
    const jwtService = { verifyAsync: vi.fn().mockResolvedValue(JWT_PAYLOAD) };
    const guildOwnership = { resolveOwnerGuildId: vi.fn().mockResolvedValue("guild-2") };
    const guard = new ServiceOrJwtGuard(fakeConfig(), jwtService as never, new Reflector(), guildOwnership as never);

    const context = makeContext(fakeRequest({ bearer: "good-token", params: { id: "meeting-owned-by-guild-2" } }));
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
    expect(guildOwnership.resolveOwnerGuildId).toHaveBeenCalledWith("meeting", "meeting-owned-by-guild-2");
  });

  it("allows a meeting-id-scoped route when the meeting belongs to the caller's own guild", async () => {
    const jwtService = { verifyAsync: vi.fn().mockResolvedValue(JWT_PAYLOAD) };
    const guildOwnership = { resolveOwnerGuildId: vi.fn().mockResolvedValue("guild-1") };
    const guard = new ServiceOrJwtGuard(fakeConfig(), jwtService as never, new Reflector(), guildOwnership as never);

    const context = makeContext(fakeRequest({ bearer: "good-token", params: { id: "meeting-owned-by-guild-1" } }));
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it("uses the ResourceType metadata to resolve ownership for an attendance-id-scoped route", async () => {
    const jwtService = { verifyAsync: vi.fn().mockResolvedValue(JWT_PAYLOAD) };
    const guildOwnership = { resolveOwnerGuildId: vi.fn().mockResolvedValue("guild-1") };
    const guard = new ServiceOrJwtGuard(fakeConfig(), jwtService as never, new Reflector(), guildOwnership as never);

    const context = makeContext(fakeRequest({ bearer: "good-token", params: { id: "attendance-1" } }), "attendance");
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(guildOwnership.resolveOwnerGuildId).toHaveBeenCalledWith("attendance", "attendance-1");
  });

  it("allows a non-existent resource id through, so the controller's own 404 fires instead of a 403", async () => {
    const jwtService = { verifyAsync: vi.fn().mockResolvedValue(JWT_PAYLOAD) };
    const guildOwnership = { resolveOwnerGuildId: vi.fn().mockResolvedValue(undefined) };
    const guard = new ServiceOrJwtGuard(fakeConfig(), jwtService as never, new Reflector(), guildOwnership as never);

    const context = makeContext(fakeRequest({ bearer: "good-token", params: { id: "does-not-exist" } }));
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });
});
