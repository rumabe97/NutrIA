import { describe, expect, it } from 'vitest';

import { grantProfessionalSchema } from './Professional';

/*
 * Not a restatement of the schema: this body is the one thing that can make an
 * account a professional (`0059`), so what it refuses is a rule worth pinning —
 * and what it strips is the acceptance criterion that no other field rides in.
 */
describe('grantProfessionalSchema', () => {
  it.each(['MAD00123', 'CV-0456', '12/3456', 'abc', 'A'.repeat(20)])('accepts %s', value => {
    expect(grantProfessionalSchema.parse({ collegiateNumber: value })).toEqual({ collegiateNumber: value });
  });

  it('trims before it measures', () => {
    expect(grantProfessionalSchema.parse({ collegiateNumber: '  MAD00123  ' })).toEqual({ collegiateNumber: 'MAD00123' });
  });

  it.each([
    ['too short', 'ab'],
    ['too long', 'A'.repeat(21)],
    ['a space inside', 'MAD 00123'],
    ['punctuation the registers do not use', 'MAD.00123'],
    ['only spaces', '      '],
    ['empty', '']
  ])('refuses %s', (_label, value) => {
    expect(grantProfessionalSchema.safeParse({ collegiateNumber: value }).success).toBe(false);
  });

  it('refuses a body with no number: the grant is never a declaration', () => {
    expect(grantProfessionalSchema.safeParse({}).success).toBe(false);
  });

  it('strips anything else the body carries — a role, a practice, a client count', () => {
    const parsed = grantProfessionalSchema.parse({ collegiateNumber: 'MAD00123', includedClients: 99, practiceOpen: true, role: 'admin' });

    expect(parsed).toEqual({ collegiateNumber: 'MAD00123' });
  });
});
