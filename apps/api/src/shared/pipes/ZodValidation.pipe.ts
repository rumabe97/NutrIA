import { Injectable } from '@nestjs/common';
import { ZodError } from 'zod';

import { InputParseError } from 'core/entities/Error';

import type { PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';

/**
 * Validates a request body against a Zod schema from `packages/core`.
 *
 * The schemas are shared with the web app's forms, so a rule like "height is
 * 100–250 cm" is written once and enforced on both sides. The client-side copy
 * is a convenience; this one is the boundary.
 *
 * Returns the *parsed* value, so unknown keys are stripped rather than passed
 * through to a repository that would happily write them.
 */
@Injectable()
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    try {
      return this.schema.parse(value);
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        const fieldErrors: Record<string, string[]> = {};

        for (const issue of error.issues) {
          const key = issue.path.join('.') || '_';
          fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message];
        }

        throw new InputParseError('Datos no válidos', fieldErrors);
      }

      throw error;
    }
  }
}
