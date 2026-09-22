import { describe, expect, it } from 'vitest';

import { ownPath } from './ownPath';

describe('ownPath', () => {
  it('keeps a same-origin path, query and hash untouched', () => {
    expect(ownPath('/plan?tab=historial#top', '/inicio')).toBe('/plan?tab=historial#top');
  });

  it('keeps a relative reference with no leading slash, safe under relative resolution', () => {
    // Genuinely on-site under the contract this is safe for: `router.push`
    // resolves it the same way, against the same real origin, so it never
    // leaves the site. (Concatenation is a different contract, and not what
    // this function is for -- see SocialSignIn.tsx's own, stricter check.)
    expect(ownPath('plan/historial', '/inicio')).toBe('plan/historial');
  });

  it('falls back to the default when nothing was supplied', () => {
    expect(ownPath(undefined, '/inicio')).toBe('/inicio');
    expect(ownPath('', '/inicio')).toBe('/inicio');
  });

  it('falls back on a fully-qualified external URL', () => {
    expect(ownPath('https://evil.example/phish', '/inicio')).toBe('/inicio');
  });

  it('falls back on a protocol-relative URL', () => {
    expect(ownPath('//evil.example/phish', '/inicio')).toBe('/inicio');
  });

  it('falls back on every backslash-normalisation variant of the protocol-relative trick', () => {
    // The exact bypass class that broke a prefix-based version of this check:
    // WHATWG URL parsing treats a backslash as a forward slash for http(s).
    expect(ownPath('/\\evil.example/phish', '/inicio')).toBe('/inicio');
    expect(ownPath('\\/evil.example/phish', '/inicio')).toBe('/inicio');
    expect(ownPath('\\\\evil.example/phish', '/inicio')).toBe('/inicio');
    expect(ownPath('/\\/evil.example/phish', '/inicio')).toBe('/inicio');
  });

  it('falls back on a scheme that carries its own destination', () => {
    expect(ownPath('javascript:alert(1)', '/inicio')).toBe('/inicio');
  });

  it('falls back on a value a URL cannot parse at all, rather than throwing', () => {
    expect(() => ownPath('http://[::1', '/inicio')).not.toThrow();
    expect(ownPath('http://[::1', '/inicio')).toBe('/inicio');
  });
});
