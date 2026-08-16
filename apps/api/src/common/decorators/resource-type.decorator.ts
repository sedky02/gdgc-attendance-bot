import { SetMetadata } from "@nestjs/common";

export const RESOURCE_TYPE_KEY = "resourceType";
export type ResourceTypeValue = "meeting" | "attendance" | "meetingType";

/**
 * Tells ServiceOrJwtGuard how to resolve the guild that owns the `:id` in
 * this route, when the request itself carries no guildId to check directly.
 * Default (no decorator) is "meeting".
 */
export const ResourceType = (type: ResourceTypeValue) => SetMetadata(RESOURCE_TYPE_KEY, type);
