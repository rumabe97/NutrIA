import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { isLocalPg, LOCAL_DATABASE_URL, required } from './env';

const NEON = 'postgresql://user:pass@ep-example-pooler.example.invalid/db';

describe('NUTRIA_LOCAL_PG', () => {
  const saved = { ...process.env };

  beforeEach(() => {
    process.env.DATABASE_URL = NEON;
    process.env.DIRECT_DATABASE_URL = NEON;
    process.env.OTHER = 'kept';
  });

  afterEach(() => {
    process.env = { ...saved };
  });

  it('leaves the environment alone when unset', () => {
    delete process.env.NUTRIA_LOCAL_PG;

    expect(required('DATABASE_URL')).toBe(NEON);
    expect(required('DIRECT_DATABASE_URL')).toBe(NEON);
  });

  it('points both connection strings at the loopback Postgres, over an exported URL', () => {
    process.env.NUTRIA_LOCAL_PG = '1';

    expect(required('DATABASE_URL')).toBe(LOCAL_DATABASE_URL);
    expect(required('DIRECT_DATABASE_URL')).toBe(LOCAL_DATABASE_URL);
    expect(new URL(LOCAL_DATABASE_URL).hostname).toBe('127.0.0.1');
  });

  it('works with no connection string set at all', () => {
    process.env.NUTRIA_LOCAL_PG = '1';
    delete process.env.DATABASE_URL;

    expect(required('DATABASE_URL')).toBe(LOCAL_DATABASE_URL);
  });

  it('replaces nothing but the two connection strings', () => {
    process.env.NUTRIA_LOCAL_PG = '1';

    expect(required('OTHER')).toBe('kept');
  });

  it('refuses a value it does not understand instead of reading it as off', () => {
    process.env.NUTRIA_LOCAL_PG = 'true';

    expect(() => required('DATABASE_URL')).toThrow(/must be 1 or unset/);
    expect(isLocalPg({ NUTRIA_LOCAL_PG: '0' })).toBe(false);
  });
});
