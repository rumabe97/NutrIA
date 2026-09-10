import { Body } from '@nestjs/common';
import { ApiBody } from '@nestjs/swagger';

import { openApiSchemaOf } from '../dto/index.js';
import { ZodValidationPipe } from '../pipes/index.js';

import type { ZodDto } from '../dto/index.js';

/**
 * The only way to declare a request body.
 *
 * It binds three things that were written separately and could disagree: the
 * validation pipe, the parameter's type, and what `/api/docs` publishes as the
 * request schema. All three come from the one Zod schema the DTO names, so the
 * documented body is the enforced body by construction (`0039`).
 *
 * The pipe is bound to the *parameter*, never through `@UsePipes`, which binds
 * it to every parameter and would run the body's schema over `@CurrentUser()`.
 * That shipped once; `apps/api/AGENTS.md` § Traps has the story. Routing the
 * binding through one decorator is what stops it shipping again.
 *
 * Being the only way is the other half of the point: a body declared with a
 * bare `@Body()` — no schema, no validation, whatever was sent — now reads as
 * the exception it is instead of looking like every other handler.
 *
 * It applies a method decorator (`@ApiBody`) from a parameter decorator, which
 * is unusual and deserves its reason: TypeScript runs parameter decorators
 * before the method's own, on a prototype whose methods already exist, so the
 * descriptor is there to hand to it. Doing it here rather than asking each
 * route for a second decorator is what makes the pair impossible to half-write.
 */
export function ZodBody<T>(dto: ZodDto<T>): ParameterDecorator {
  const validate = Body(new ZodValidationPipe(dto.schema));
  const document = ApiBody({ required: true, schema: openApiSchemaOf(dto) });

  return (target, property, index) => {
    validate(target, property, index);

    if (property === undefined) {
      return;
    }

    const method = Object.getOwnPropertyDescriptor(target, property);

    if (method) {
      document(target, property, method);
    }
  };
}
