import { Query } from '@nestjs/common';

import { ZodValidationPipe } from '../../../shared/index.js';

import type { ZodDto } from '../../../shared/index.js';

/**
 * The whole query string validated against a DTO's schema, bound to this one
 * parameter — never through `@UsePipes`, which would run it over every
 * parameter (`AGENTS.md` § Traps). A refused value is a 422 `INVALID_INPUT`,
 * like a body; an unknown key is stripped. Guards run before pipes, so a
 * non-admin is a 404 before anything here is read.
 */
export function ZodQuery<T>(dto: ZodDto<T>): ParameterDecorator {
  return Query(new ZodValidationPipe(dto.schema));
}
