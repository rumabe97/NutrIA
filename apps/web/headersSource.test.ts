import { getPathMatch } from 'next/dist/shared/lib/router/utils/path-match';
import { describe, expect, it } from 'vitest';

import { pagesSource } from './headersSource.js';

const matches = (source: string, path: string) => getPathMatch(source)(path) !== false;

describe('pagesSource', () => {
  const source = pagesSource('/api/v1');

  it.each(['/', '/acceder', '/es/restablecer', '/en/registro', '/api/v10', '/api/v1x'])(
    'puts the headers on %s',
    (path) => {
      expect(matches(source, path)).toBe(true);
    }
  );

  it.each(['/api/v1', '/api/v1/', '/api/v1/auth/reset-password'])('leaves the proxied %s out', (path) => {
    expect(matches(source, path)).toBe(false);
  });

  it('with no upstream, matches every path', () => {
    const open = pagesSource(undefined);

    expect(open).toBe('/:path*');

    for (const path of ['/', '/acceder', '/api/v1', '/api/v1/auth/reset-password']) {
      expect(matches(open, path)).toBe(true);
    }
  });
});
