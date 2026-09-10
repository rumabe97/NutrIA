import { describe, expect, it } from 'vitest';

import { DEFAULT_WEB_LOCALE, webUrl } from './WebUrl';

const APP = 'https://nutria.example';

describe('webUrl — Spanish is the root', () => {
  it('leaves the path alone for Spanish', () => {
    expect(webUrl(APP, '/check-in', 'es-ES')).toBe('https://nutria.example/check-in');
  });

  it('treats the default as Spanish', () => {
    expect(DEFAULT_WEB_LOCALE).toBe('es-ES');
    expect(webUrl(APP, '/check-in', DEFAULT_WEB_LOCALE)).toBe(webUrl(APP, '/check-in'));
  });
});

describe('webUrl — every other language names itself', () => {
  it('puts the segment in front of the path for English', () => {
    expect(webUrl(APP, '/check-in', 'en-GB')).toBe('https://nutria.example/en/check-in');
  });

  it('is the bare segment for the home page', () => {
    expect(webUrl(APP, '/', 'en-GB')).toBe('https://nutria.example/en');
  });

  it('keeps the query and the fragment', () => {
    expect(webUrl(APP, '/admin?abierta=ana%40example.com#lista', 'en-GB')).toBe('https://nutria.example/en/admin?abierta=ana%40example.com#lista');
  });
});

describe('webUrl — an unknown language is Spanish, never a guess', () => {
  it.each([null, undefined, '', 'fr-FR', 'en', 'EN-GB', 'toString'])('falls back for %p', locale => {
    expect(webUrl(APP, '/check-in', locale)).toBe('https://nutria.example/check-in');
  });
});

describe('webUrl — prefixing twice is impossible', () => {
  it('leaves a path that already names a language alone', () => {
    expect(webUrl(APP, '/en/check-in', 'en-GB')).toBe('https://nutria.example/en/check-in');
  });

  it('does not re-language a path the caller was explicit about', () => {
    expect(webUrl(APP, '/en/check-in', 'es-ES')).toBe('https://nutria.example/en/check-in');
  });

  it('is not fooled by a path that merely starts with the letters', () => {
    expect(webUrl(APP, '/entrar', 'en-GB')).toBe('https://nutria.example/en/entrar');
  });
});

describe('webUrl — the origin is the product', () => {
  it('ignores an absolute url handed in as a path', () => {
    expect(webUrl(APP, 'https://phish.example/plan', 'en-GB')).toBe('https://nutria.example/en/plan');
  });

  it('ignores a protocol-relative url handed in as a path', () => {
    expect(webUrl(APP, '//phish.example/plan', 'es-ES')).toBe('https://nutria.example/plan');
  });

  it('keeps the port and drops anything the app url carried beyond its origin', () => {
    expect(webUrl('http://localhost:3000/whatever', '/check-in', 'en-GB')).toBe('http://localhost:3000/en/check-in');
  });

  it('accepts a path with no leading slash', () => {
    expect(webUrl(APP, 'check-in', 'en-GB')).toBe('https://nutria.example/en/check-in');
  });
});
