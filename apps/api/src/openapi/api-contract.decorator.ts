import { applyDecorators } from "@nestjs/common";
import { ApiBadRequestResponse, ApiBody, ApiQuery, ApiResponse } from "@nestjs/swagger";
import type { SchemaObject } from "@nestjs/swagger/dist/interfaces/open-api-spec.interface.js";
import { contractSchemaRef, inlineContractSchema, type ContractSchemaName } from "./contract-schemas.js";

function refSchema(name: ContractSchemaName, isArray: boolean): SchemaObject {
  const ref = { $ref: contractSchemaRef(name) };
  return (isArray ? { type: "array", items: ref } : ref) as SchemaObject;
}

/** Documents the request body as one of the shared contracts. */
export const ApiContractBody = (name: ContractSchemaName) =>
  ApiBody({ required: true, schema: refSchema(name, false) });

/** Documents a response body as one of the shared contracts. */
export const ApiContractResponse = (
  status: number,
  name: ContractSchemaName,
  options: { isArray?: boolean; description?: string } = {},
) =>
  ApiResponse({
    status,
    description: options.description,
    schema: refSchema(name, options.isArray ?? false),
  });

/**
 * Expands a query DTO into one `?name=` parameter per property, reading the
 * names, types and optionality straight off the Zod schema so the docs can't
 * drift from what ZodValidationPipe actually accepts.
 */
export function ApiContractQuery(name: ContractSchemaName) {
  const { properties = {}, required = [] } = inlineContractSchema(name);
  const isRequired = new Set(required);

  return applyDecorators(
    ...Object.entries(properties).map(([property, schema]) =>
      ApiQuery({
        name: property,
        required: isRequired.has(property),
        schema: schema as SchemaObject,
      }),
    ),
  );
}

/** ZodValidationPipe rejected the payload and returned the flattened error. */
export const ApiContractValidationResponse = () =>
  ApiBadRequestResponse({ description: "Body or query failed contract validation" });
