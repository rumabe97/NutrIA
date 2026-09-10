import { z } from 'zod';

import type { ZodDto } from './ZodDto.js';
import type { ApiBodyOptions } from '@nestjs/swagger';

/**
 * What `@ApiBody({ schema })` takes. Read off the decorator's own options
 * rather than imported from swagger's `dist/`, which is not a public entry
 * point and would move under us on a minor release.
 */
type OpenApiSchema = Extract<ApiBodyOptions, { schema: unknown }>['schema'];

/**
 * The published request schema of a DTO, generated from the Zod schema that
 * enforces it.
 *
 * Generated rather than written, because a hand-written schema is a claim about
 * the body that nothing checks: it can be right on the day it is typed and
 * wrong the day the rule moves. This one cannot be wrong — it is the rule.
 *
 * `unrepresentable: 'any'` keeps a refinement Zod cannot express in JSON Schema
 * from throwing at import time and taking the whole application's boot with it.
 * Such a rule is still enforced; it is just not *described*, which is the right
 * way round — under-documenting a body is a smaller failure than refusing to
 * start, and far smaller than documenting one that is not enforced.
 */
export function openApiSchemaOf<T>(dto: ZodDto<T>): OpenApiSchema {
  const json = z.toJSONSchema(dto.schema, { io: 'input', target: 'openapi-3.0', unrepresentable: 'any' });

  // Zod and OpenAPI describe the same JSON Schema with different TypeScript
  // types — Zod's models `not: false`, which `SchemaObject` does not — so the
  // two definitions never meet even though the values are identical. This is
  // the one assertion in the app, kept at that seam so no route repeats it.
  return { ...json, title: dto.name } as OpenApiSchema;
}
