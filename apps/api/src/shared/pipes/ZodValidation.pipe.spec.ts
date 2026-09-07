import { describe, expect, it } from '@jest/globals';
import { z } from 'zod';

import { InputParseError } from 'core/entities/Error';
import { updateProfileSchema } from 'core/entities/Profile';

import { ZodValidationPipe } from './ZodValidation.pipe.js';

describe('ZodValidationPipe', () => {
  it('returns the parsed value', () => {
    const pipe = new ZodValidationPipe(z.object({ n: z.coerce.number() }));

    expect(pipe.transform({ n: '42' })).toEqual({ n: 42 });
  });

  it('strips unknown keys so they never reach a repository', () => {
    const pipe = new ZodValidationPipe(updateProfileSchema);

    expect(pipe.transform({ displayName: 'Ada', userId: 'usr_someone_else' })).toEqual({ displayName: 'Ada' });
  });

  it('throws InputParseError with per-field messages', () => {
    const pipe = new ZodValidationPipe(updateProfileSchema);

    try {
      pipe.transform({ heightCm: 3 });
      throw new Error('expected the pipe to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(InputParseError);
      expect((error as InputParseError).fieldErrors).toHaveProperty('heightCm');
    }
  });

  it('enforces the shared height bounds — the same rule the web form uses', () => {
    const pipe = new ZodValidationPipe(updateProfileSchema);

    expect(() => pipe.transform({ heightCm: 300 })).toThrow(InputParseError);
    expect(pipe.transform({ heightCm: 168 })).toEqual({ heightCm: 168 });
  });
});
