import { describe, expect, it } from 'vitest';

import { practiceState } from './practiceState';

const CLOSES = '2026-12-19T00:00:00.000Z';

function closing(closed: boolean) {
  return { closed, closesAt: CLOSES, decidedAt: '2026-11-19T00:00:00.000Z', statement: null };
}

const suspended = { since: '2026-11-19T00:00:00.000Z', statement: null };

/* Profesionales shows what stands on a practice in a word (PRD 025 scope 16) until phase 9 gives the acts. */
describe('practiceState', () => {
  it('is open when nothing stands', () => {
    expect(practiceState({ practising: true, restriction: null })).toEqual([{ kind: 'open' }]);
  });

  it('says a suspension, a close to come with its day, and both at once', () => {
    expect(practiceState({ practising: true, restriction: { closing: null, suspended } })).toEqual([{ kind: 'suspended' }]);
    expect(practiceState({ practising: true, restriction: { closing: closing(false), suspended: null } })).toEqual([
      { closesAt: CLOSES, kind: 'closing' }
    ]);
    expect(practiceState({ practising: true, restriction: { closing: closing(false), suspended } })).toEqual([
      { kind: 'suspended' },
      { closesAt: CLOSES, kind: 'closing' }
    ]);
  });

  it('says a close due but not carried out as due, not closed: the practice still exists until the sweep', () => {
    expect(practiceState({ practising: true, restriction: { closing: closing(true), suspended: null } })).toEqual([
      { closesAt: CLOSES, kind: 'closeDue' }
    ]);
  });

  it('is closed only when the account has no practice left', () => {
    expect(practiceState({ practising: false, restriction: { closing: closing(true), suspended: null } })).toEqual([{ kind: 'closed' }]);
    expect(practiceState({ practising: false, restriction: null })).toEqual([{ kind: 'closed' }]);
  });
});
