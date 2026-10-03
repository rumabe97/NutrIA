import { describe, expect, it } from 'vitest';

import { contentSecurityPolicy } from './csp.js';

describe('contentSecurityPolicy', () => {
  const policy = contentSecurityPolicy({ apiUrl: 'https://app.example/api/v1', development: false });
  const directive = (name: string) => policy.split('; ').find(part => part.startsWith(`${name} `));

  it('forbids framing, plugins and a changed base', () => {
    expect(directive('frame-ancestors')).toBe("frame-ancestors 'none'");
    expect(directive('object-src')).toBe("object-src 'none'");
    expect(directive('base-uri')).toBe("base-uri 'self'");
  });

  it('allows the API origin, the Blob store and nothing else foreign', () => {
    expect(directive('connect-src')).toBe("connect-src 'self' https://app.example");
    expect(directive('img-src')).toContain('https://*.public.blob.vercel-storage.com');
    expect(policy).not.toMatch(/https:\/\/(?!app\.example|\*\.public\.blob)/);
  });

  it('reports to the API', () => {
    expect(directive('report-uri')).toBe('report-uri https://app.example/api/v1/csp-report');
  });

  it('allows eval only in development', () => {
    expect(policy).not.toContain('unsafe-eval');
    expect(contentSecurityPolicy({ apiUrl: undefined, development: true })).toContain("'unsafe-eval'");
  });

  it('without an API address, names none and reports nowhere', () => {
    const bare = contentSecurityPolicy({ apiUrl: undefined, development: false });

    expect(bare).not.toContain('report-uri');
    expect(bare).toContain("connect-src 'self'");
  });
});
