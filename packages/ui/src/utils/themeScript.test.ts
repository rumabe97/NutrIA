import { describe, expect, it } from 'vitest';

import { storedTheme, THEME_SCRIPT, THEME_STORAGE_KEY } from './themeScript';

/** Runs the inline script against a store and a root of our own, and returns what it set. */
function runScript(read: (key: string) => string | null) {
  const set: Record<string, string> = {};
  const style: { colorScheme?: string } = {};
  const root = { setAttribute: (name: string, value: string) => (set[name] = value), style };
  const localStorage = { getItem: read };

  // The script is a string by design — it is what the page runs — so it is run as one.
  const script = new Function('localStorage', 'document', THEME_SCRIPT) as (
    store: typeof localStorage,
    doc: { documentElement: typeof root }
  ) => void;

  script(localStorage, { documentElement: root });

  return Object.keys(set).length === 0 && style.colorScheme === undefined ? null : { colorScheme: style.colorScheme, theme: set['data-theme'] };
}

/** A store that throws on the read, as Safari's does with storage blocked. */
function throwing(): never {
  throw new DOMException('The operation is insecure.', 'SecurityError');
}

describe('storedTheme', () => {
  it('reads each of the five themes, with the scheme its surfaces are painted in', () => {
    expect(storedTheme(() => 'claro')).toEqual({ colorScheme: 'light', theme: 'claro' });
    expect(storedTheme(() => 'oscuro')).toEqual({ colorScheme: 'dark', theme: 'oscuro' });
    expect(storedTheme(() => 'huerta')).toEqual({ colorScheme: 'light', theme: 'huerta' });
    expect(storedTheme(() => 'pulso')).toEqual({ colorScheme: 'dark', theme: 'pulso' });
    expect(storedTheme(() => 'contraste')).toEqual({ colorScheme: 'light', theme: 'contraste' });
  });

  it('falls back to Automático on nothing stored, an unknown value or a key of every object', () => {
    for (const value of [null, '', 'dark', 'Claro', ' claro', 'automatico', '__proto__', 'constructor', 'toString']) {
      expect(storedTheme(() => value)).toBeNull();
    }
  });

  it('falls back to Automático when the store throws', () => {
    expect(storedTheme(throwing)).toBeNull();
  });
});

describe('THEME_SCRIPT', () => {
  it('is one static string, so every page carries the same bytes', () => {
    expect(typeof THEME_SCRIPT).toBe('string');
    expect(THEME_SCRIPT).toContain(JSON.stringify(THEME_STORAGE_KEY));
  });

  it('reads the key the switch writes', () => {
    const asked: string[] = [];

    runScript(key => {
      asked.push(key);

      return null;
    });

    expect(asked).toEqual([THEME_STORAGE_KEY]);
  });

  it('gives the same answer as storedTheme for every value, and sets nothing when there is none', () => {
    const values = ['claro', 'oscuro', 'huerta', 'pulso', 'contraste', null, '', 'dark', 'Claro', '__proto__', 'constructor', 'hasOwnProperty'];

    for (const value of values) {
      expect(runScript(() => value)).toEqual(storedTheme(() => value));
    }
  });

  it('sets nothing, and does not throw, when the store throws', () => {
    expect(() => runScript(throwing)).not.toThrow();
    expect(runScript(throwing)).toBeNull();
  });
});
