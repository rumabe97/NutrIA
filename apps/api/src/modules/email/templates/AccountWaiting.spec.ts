import { describe, expect, it } from '@jest/globals';

import { accountWaitingEmail } from './AccountWaiting.js';

const URL = 'https://nutria.example/es/admin/cuentas?activated=no';

/**
 * The mail stays in the owner's inbox for good, so what it may carry is the
 * point of the spec: that an account waits, and the way to the console.
 */
describe('accountWaitingEmail', () => {
  it.each(['es-ES', 'en-GB'] as const)('names nobody and issues no activation link in %s', locale => {
    const mail = accountWaitingEmail({ locale, url: URL });

    for (const part of [mail.subject, mail.text, mail.html]) {
      expect(part).not.toContain('@');
      expect(part).not.toMatch(/usr-/);
      expect(part).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
      expect(part).not.toMatch(/token/i);
      expect(part).not.toContain('/admin/activate');
      expect(part).not.toContain('update "user"');
    }
  });

  it.each(['es-ES', 'en-GB'] as const)('links to the console in %s', locale => {
    const mail = accountWaitingEmail({ locale, url: URL });

    expect(mail.text).toContain(URL);
    expect(mail.html).toContain('href="https://nutria.example/es/admin/cuentas?activated=no"');
  });
});
