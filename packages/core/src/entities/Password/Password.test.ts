import { describe, expect, it } from 'vitest';

import { newPasswordSchema, PASSWORD_ERROR_CODES, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, passwordHasContext } from 'core/entities/Password';

// Pinned as literals: the web app, Better Auth's options and the end-to-end
// suites all answer to these two numbers.
describe('the password lengths', () => {
  it('are 12 and 128', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(12);
    expect(PASSWORD_MAX_LENGTH).toBe(128);
  });

  it('refuse 11 characters, accept 12 and 128, refuse 129', () => {
    expect(newPasswordSchema.safeParse('a'.repeat(11)).success).toBe(false);
    expect(newPasswordSchema.safeParse('a'.repeat(12)).success).toBe(true);
    expect(newPasswordSchema.safeParse('a'.repeat(128)).success).toBe(true);
    expect(newPasswordSchema.safeParse('a'.repeat(129)).success).toBe(false);
  });

  it('ask for no composition: twelve lower-case letters are enough', () => {
    expect(newPasswordSchema.safeParse('abcdefghijkl').success).toBe(true);
    expect(newPasswordSchema.safeParse('frase con espacios').success).toBe(true);
  });

  it('count the way Better Auth counts — JavaScript string length', () => {
    // Six emoji are twelve UTF-16 code units.
    expect(newPasswordSchema.safeParse('🍎'.repeat(6)).success).toBe(true);
    expect(newPasswordSchema.safeParse('🍎'.repeat(5)).success).toBe(false);
    // Sixty-five are 130: too long for Better Auth, so too long here.
    expect(newPasswordSchema.safeParse('🍎'.repeat(65)).success).toBe(false);
  });

  it('raise the issues `.min()` and `.max()` would', () => {
    expect(newPasswordSchema.safeParse('short').error?.issues[0]).toMatchObject({ code: 'too_small', minimum: 12 });
    expect(newPasswordSchema.safeParse('a'.repeat(129)).error?.issues[0]).toMatchObject({ code: 'too_big', maximum: 128 });
  });
});

describe('PASSWORD_ERROR_CODES', () => {
  it('are the two closed codes the web app maps', () => {
    expect(PASSWORD_ERROR_CODES).toEqual({ compromised: 'PASSWORD_COMPROMISED', hasContext: 'PASSWORD_HAS_CONTEXT' });
  });
});

describe('passwordHasContext', () => {
  const context = { email: 'Maria.Garcia@example.com', name: 'María José García-López' };

  it('refuses the email local part as a substring, whatever its case', () => {
    expect(passwordHasContext('my-maria.garcia-forever', context)).toBe(true);
    expect(passwordHasContext('XXMARIA.GARCIAXX', context)).toBe(true);
  });

  it('refuses any word of the name, split on spaces and hyphens, case- and accent-insensitively', () => {
    expect(passwordHasContext('una-frase-con-maria-dentro', { name: 'María' })).toBe(true);
    expect(passwordHasContext('JOSE-y-sus-amigos', context)).toBe(true);
    expect(passwordHasContext('garcia garcia garcia', context)).toBe(true);
    expect(passwordHasContext('caballo-lopez-azul', context)).toBe(true);
  });

  it('folds accents on the password side too', () => {
    expect(passwordHasContext('caballo-lópez-azul', { name: 'Lopez' })).toBe(true);
    expect(passwordHasContext('MARÍA en la playa', { email: 'maria@example.com' })).toBe(true);
  });

  it('refuses "nutria", with no context at all', () => {
    expect(passwordHasContext('mi-cuenta-de-nutria', {})).toBe(true);
    expect(passwordHasContext('NÚTRIA-por-siempre', { email: null, name: null })).toBe(true);
  });

  it('ignores a local part or a name word under three characters', () => {
    expect(passwordHasContext('caballo-al-tren', { email: 'al@example.com', name: 'Al Li' })).toBe(false);
    expect(passwordHasContext('caballo-li-tren', { name: 'Li' })).toBe(false);
  });

  it('accepts a password with none of the words', () => {
    expect(passwordHasContext('correct-horse-battery-staple-9', context)).toBe(false);
    expect(passwordHasContext('correct-horse-battery-staple-9', { email: 'e2e-1234@example.invalid', name: 'E2E Tester' })).toBe(false);
  });

  it('matches a word only, never the whole name joined up', () => {
    expect(passwordHasContext('mariajose-caballo', { name: 'Ma Ri' })).toBe(false);
  });
});
