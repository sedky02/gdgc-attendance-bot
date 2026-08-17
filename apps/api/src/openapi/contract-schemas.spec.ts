import { describe, expect, it } from "vitest";
import { CONTRACT_SCHEMAS, buildContractSchemas, contractSchemaRef, inlineContractSchema } from "./contract-schemas.js";

/** Every `$ref` string anywhere in a nested structure. */
function collectRefs(node: unknown, found: string[] = []): string[] {
  if (Array.isArray(node)) {
    node.forEach((child) => collectRefs(child, found));
    return found;
  }
  if (typeof node === "object" && node !== null) {
    for (const [key, value] of Object.entries(node)) {
      if (key === "$ref" && typeof value === "string") {
        found.push(value);
      } else {
        collectRefs(value, found);
      }
    }
  }
  return found;
}

describe("contract schemas", () => {
  const schemas = buildContractSchemas();

  it("emits one component per registered contract", () => {
    expect(Object.keys(schemas).sort()).toEqual(Object.keys(CONTRACT_SCHEMAS).sort());
  });

  it("resolves every $ref to a registered component — no dangling references", () => {
    const registered = new Set(Object.keys(CONTRACT_SCHEMAS).map((name) => `#/components/schemas/${name}`));
    const refs = collectRefs(schemas);

    expect(refs.length).toBeGreaterThan(0);
    expect([...new Set(refs)].filter((ref) => !registered.has(ref))).toEqual([]);
  });

  it("cross-references nested contracts instead of inlining copies of them", () => {
    // MeetingReport embeds Meeting, Attendance and ExpectedMember. If these
    // were inlined, Meeting's definition would be duplicated into six places
    // and editing the Zod schema would silently update only some of them.
    expect(collectRefs(schemas.MeetingReport).sort()).toEqual([
      contractSchemaRef("Attendance"),
      contractSchemaRef("ExpectedMember"),
      contractSchemaRef("Meeting"),
    ]);
  });

  it("renders coerced dates as date-time strings, which is what a client actually sends", () => {
    const meeting = schemas.Meeting as { properties: Record<string, unknown> };
    expect(meeting.properties.startedAt).toEqual({ type: "string", format: "date-time" });
    expect(meeting.properties.endedAt).toEqual({ type: "string", format: "date-time", nullable: true });
  });

  it("inlines query DTOs so each property can become its own query parameter", () => {
    const { properties = {}, required = [] } = inlineContractSchema("ListMeetingsQueryDto");

    expect(Object.keys(properties).sort()).toEqual(["guildId", "page", "status"]);
    expect(required).toEqual(["guildId"]);
    expect(collectRefs(properties)).toEqual([]);
  });

  it("documents the archived filter as the two literals the query parser accepts, not a boolean", () => {
    // z.coerce.boolean() would make "false" mean true; the contract parses
    // "true"/"false" explicitly, and the docs have to say so.
    const { properties = {} } = inlineContractSchema("ListMeetingTypesQueryDto");
    expect(properties.archived).toEqual({ type: "string", enum: ["true", "false"] });
  });
});
