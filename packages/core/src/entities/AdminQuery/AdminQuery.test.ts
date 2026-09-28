import { describe, expect, it } from 'vitest';

import { accountQuerySchema } from './AdminQuery';

describe('the admin tables search', () => {
  it('trims the text and treats a blank one as absent', () => {
    expect(accountQuerySchema.parse({ q: '  ana  ' }).q).toBe('ana');
    expect(accountQuerySchema.parse({ q: '   ' }).q).toBeUndefined();
  });

  it('refuses a NUL character, which Postgres cannot hold in text', () => {
    expect(accountQuerySchema.safeParse({ q: 'a\u0000b' }).success).toBe(false);
  });
});
