import type { ZodType } from 'zod';

/**
 * A route body's contract: the name it is published under, and the schema that
 * decides whether a body is valid.
 *
 * The schema is always one of `packages/core/entities`' — the same object the
 * web form validates against — so a DTO here *names* a rule and never restates
 * one (`0039`). Everything else about the body is derived from it: the handler
 * parameter's type through `InferDto`, the OpenAPI request schema through
 * `openApiSchemaOf`. There is no place for the two to disagree because there is
 * only one of them.
 */
export interface ZodDto<T> {
  readonly name: string;
  readonly schema: ZodType<T>;
}

/** The type a body arrives as, read off its DTO rather than written twice. */
export type InferDto<D> = D extends ZodDto<infer T> ? T : never;

/**
 * `name` is what the schema is titled in `/api/docs`. It is the entity's own
 * name — `SubmitFeedback`, not `SubmitFeedbackBody` — because the reader of the
 * documentation and the reader of `packages/core` should be looking at the same
 * word.
 */
export function zodDto<T>(name: string, schema: ZodType<T>): ZodDto<T> {
  return { name, schema };
}
