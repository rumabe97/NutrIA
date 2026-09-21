import { afterEach, describe, expect, it, vi } from 'vitest';

import { markArrival, takeArrival } from './arrival';

function storage() {
  const held = new Map<string, string>();

  return {
    getItem: (key: string) => held.get(key) ?? null,
    removeItem: (key: string) => void held.delete(key),
    setItem: (key: string, value: string) => void held.set(key, value)
  };
}

describe('arrival', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is true exactly once after a tab said it was leaving for a provider', () => {
    vi.stubGlobal('sessionStorage', storage());

    expect(takeArrival()).toBe(false);
    markArrival();
    expect(takeArrival()).toBe(true);
    expect(takeArrival()).toBe(false);
  });

  it('is simply false where storage is refused, rather than an error on the sign-in page', () => {
    vi.stubGlobal('sessionStorage', {
      getItem: () => {
        throw new Error('denied');
      },
      removeItem: () => undefined,
      setItem: () => {
        throw new Error('denied');
      }
    });

    expect(() => markArrival()).not.toThrow();
    expect(takeArrival()).toBe(false);
  });
});
