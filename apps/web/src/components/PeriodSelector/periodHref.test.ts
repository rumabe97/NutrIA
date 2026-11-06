import { describe, expect, it } from 'vitest';

import { periodHref } from './periodHref';

describe('periodHref', () => {
  it('sets the period on a page with no query', () => {
    expect(periodHref('/admin', {}, 7)).toBe('/admin?period=7');
  });

  it('replaces the period and keeps every other parameter, repeated ones in order', () => {
    // Any parameter, repeated, encoded: the real one this was written for (`abierta`,
    // from a mailed link) is gone, and what it proved is not about that name.
    expect(periodHref('/admin', { otro: ['a@example.com', 'b@example.com'], period: '30', q: 'x' }, 90)).toBe(
      '/admin?otro=a%40example.com&otro=b%40example.com&q=x&period=90'
    );
  });

  it('drops a parameter Next left undefined', () => {
    expect(periodHref('/admin/producto', { q: undefined }, 30)).toBe('/admin/producto?period=30');
  });
});
