import { describe, expect, it } from '@jest/globals';

import { passwordResetEmail } from './PasswordReset.js';

const URL = 'https://nutria.example/api/v1/auth/reset-password/tok_123?callbackURL=/restablecer&x=1';

describe('passwordResetEmail', () => {
  it('carries the link in both the text and the HTML body', () => {
    const mail = passwordResetEmail({ locale: 'es-ES', url: URL });

    expect(mail.text).toContain(URL);
    expect(mail.html).toContain('href="https://nutria.example/api/v1/auth/reset-password/tok_123?callbackURL=/restablecer&amp;x=1"');
  });

  it('escapes the link inside HTML rather than pasting it raw', () => {
    const mail = passwordResetEmail({ locale: 'es-ES', url: 'https://x.example/?a=1&b=<2>' });

    expect(mail.html).not.toContain('&b=<2>');
    expect(mail.html).toContain('&amp;b=&lt;2&gt;');
  });

  it('speaks the requested language', () => {
    expect(passwordResetEmail({ locale: 'es-ES', url: URL }).subject).toBe('Restablece tu contraseña de NutrIA');
    expect(passwordResetEmail({ locale: 'en-GB', url: URL }).subject).toBe('Reset your NutrIA password');
    expect(passwordResetEmail({ locale: 'en-GB', url: URL }).html).toContain('lang="en"');
  });

  it('says the link expires and that an unrequested mail changes nothing', () => {
    const mail = passwordResetEmail({ locale: 'es-ES', url: URL });

    expect(mail.text).toContain('una hora');
    expect(mail.text).toContain('tu contraseña no ha cambiado');
  });
});
