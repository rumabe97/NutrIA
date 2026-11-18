import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';

import { BADGE_CODE_MAX_ATTEMPTS } from 'core/entities/Professional';

import {
  badgeFrom,
  codeIsLive,
  dueDate,
  lapseDate,
  newestFirst,
  pendingApplication,
  ProfessionalBadgeRepository
} from './ProfessionalBadgeRepository';

import type { ProfessionalBadgeCheck, ProfessionalBadgeCode } from 'core/entities/Professional';
import type { SQL } from 'drizzle-orm';

const dialect = new PgDialect({ casing: 'snake_case' });

let rows: Record<string, unknown>[] = [];
let where: SQL | undefined;
let order: SQL[] = [];

vi.mock('database', () => ({
  database: () => ({
    select: () => {
      const chain = {
        from: () => chain,
        limit: () => Promise.resolve(rows),
        orderBy: (...by: SQL[]) => {
          order = by;

          return chain;
        },
        where: (clause: SQL) => {
          where = clause;

          return chain;
        }
      };

      return chain;
    }
  })
}));

const NOW = new Date('2026-11-18T09:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;
let sequence = 0;

/** A check, `days` before NOW (negative: after), written in that order. */
function check(kind: ProfessionalBadgeCheck['kind'], days: number, overrides: Partial<ProfessionalBadgeCheck> = {}): ProfessionalBadgeCheck {
  sequence += 1;
  const at = new Date(NOW.getTime() - days * DAY);

  return {
    id: `00000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`,
    channel: kind === 'pass' ? 'register_email' : null,
    checkedAt: at,
    checkedBy: kind === 'applied' || kind === 'lapsed' ? null : 'usr-owner',
    createdAt: new Date(at.getTime() + sequence),
    dueAt: kind === 'pass' ? dueDate(at) : null,
    kind,
    number: 'MAD00123',
    reason: ['fail', 'withdrawn', 'lapsed'].includes(kind) ? 'because' : null,
    register: 'Colegio de Madrid',
    updatedAt: at,
    userId: 'usr-pro',
    ...overrides
  };
}

function code(overrides: Partial<ProfessionalBadgeCode> = {}): ProfessionalBadgeCode {
  return {
    id: '00000000-0000-4000-8000-0000000000ff',
    attempts: 0,
    channel: 'post',
    checkId: '00000000-0000-4000-8000-000000000001',
    codeHash: 'hash',
    createdAt: NOW,
    expiresAt: new Date(NOW.getTime() + 30 * DAY),
    updatedAt: NOW,
    usedAt: null,
    userId: 'usr-pro',
    ...overrides
  };
}

describe('dueDate and lapseDate', () => {
  it('falls due twelve calendar months after the pass and lapses thirty days after that', () => {
    const due = dueDate(new Date('2026-02-28T10:00:00.000Z'));

    expect(due.toISOString()).toBe('2027-02-28T10:00:00.000Z');
    expect(lapseDate(due).toISOString()).toBe('2027-03-30T10:00:00.000Z');
  });
});

describe('badgeFrom — the one definition of the badge', () => {
  it('is null with no check at all, and with only an application', () => {
    expect(badgeFrom([], NOW)).toBeNull();
    expect(badgeFrom([check('applied', 3)], NOW)).toBeNull();
  });

  it('stands on a pass, with its number, register, due and lapse dates', () => {
    const pass = check('pass', 10);

    expect(badgeFrom([check('applied', 20), pass], NOW)).toEqual({
      channel: 'register_email',
      checkedAt: pass.checkedAt,
      checkId: pass.id,
      dueAt: pass.dueAt,
      lapsesAt: lapseDate(pass.dueAt as Date),
      number: 'MAD00123',
      register: 'Colegio de Madrid'
    });
  });

  it('still stands once due, until thirty days past due, and not an instant longer', () => {
    const pass = check('pass', 365 + 29);
    const lapses = lapseDate(pass.dueAt as Date);

    expect(badgeFrom([pass], NOW)).not.toBeNull();
    expect(badgeFrom([pass], new Date(lapses.getTime() - 1))).not.toBeNull();
    expect(badgeFrom([pass], lapses)).toBeNull();
  });

  it.each(['fail', 'withdrawn', 'lapsed'] as const)('is gone the moment a later %s is written', kind => {
    expect(badgeFrom([check('pass', 30), check(kind, 1)], NOW)).toBeNull();
  });

  it('is not revived by an application after a withdrawal', () => {
    expect(badgeFrom([check('pass', 30), check('withdrawn', 10), check('applied', 1)], NOW)).toBeNull();
  });

  it('stands again on a pass written after a removal', () => {
    expect(badgeFrom([check('pass', 300), check('lapsed', 30), check('pass', 1)], NOW)).not.toBeNull();
  });

  it('reads the order from the dates, not from the array', () => {
    const later = check('withdrawn', 1);
    const earlier = check('pass', 30);

    expect(badgeFrom([later, earlier], NOW)).toBeNull();
    expect(newestFirst([earlier, later])[0]).toBe(later);
  });

  it('breaks a tie on the check’s date by the order the rows were written', () => {
    const pass = check('pass', 5);
    const withdrawn = check('withdrawn', 5, { checkedAt: pass.checkedAt });

    expect(badgeFrom([withdrawn, pass], NOW)).toBeNull();
  });

  it('is null for a pass with no due date, which the database refuses anyway', () => {
    expect(badgeFrom([check('pass', 1, { dueAt: null })], NOW)).toBeNull();
  });
});

describe('pendingApplication', () => {
  it('is the latest application when nothing decisive came after it', () => {
    const second = check('applied', 1, { number: 'MAD00999' });

    expect(pendingApplication([check('applied', 5), second])).toBe(second);
  });

  it('is nothing once the owner decided after it, either way', () => {
    expect(pendingApplication([check('applied', 5), check('pass', 1)])).toBeUndefined();
    expect(pendingApplication([check('applied', 5), check('fail', 1)])).toBeUndefined();
    expect(pendingApplication([])).toBeUndefined();
  });

  it('is a new application made after a lapse', () => {
    const again = check('applied', 1);

    expect(pendingApplication([check('pass', 400), check('lapsed', 10), again])).toBe(again);
  });
});

describe('codeIsLive', () => {
  it('is live unused, unexpired and under its cap', () => {
    expect(codeIsLive(code(), NOW)).toBe(true);
  });

  it('is dead once used, once expired, and at the cap of wrong attempts', () => {
    expect(codeIsLive(code({ usedAt: NOW }), NOW)).toBe(false);
    expect(codeIsLive(code({ expiresAt: NOW }), NOW)).toBe(false);
    expect(codeIsLive(code({ attempts: BADGE_CODE_MAX_ATTEMPTS }), NOW)).toBe(false);
    expect(codeIsLive(code({ attempts: BADGE_CODE_MAX_ATTEMPTS - 1 }), NOW)).toBe(true);
  });
});

describe('ProfessionalBadgeRepository.badgeOf', () => {
  beforeEach(() => {
    rows = [];
    where = undefined;
    order = [];
  });

  it('reads the account’s latest decisive check, by its id alone, newest first', async () => {
    rows = [check('pass', 10)];

    await expect(ProfessionalBadgeRepository.badgeOf('usr-pro', NOW)).resolves.toMatchObject({ number: 'MAD00123' });

    const { params, sql } = dialect.sqlToQuery(where as SQL);

    expect(sql).toBe('("professional_badge_checks"."user_id" = $1 and "professional_badge_checks"."kind" in ($2, $3, $4, $5))');
    expect(params).toEqual(['usr-pro', 'pass', 'fail', 'withdrawn', 'lapsed']);
    expect(order.map(by => dialect.sqlToQuery(by).sql)).toEqual([
      '"professional_badge_checks"."checked_at" desc',
      '"professional_badge_checks"."created_at" desc'
    ]);
  });

  it('is null when the latest decisive check is not a pass, or there is none', async () => {
    rows = [check('withdrawn', 1)];
    await expect(ProfessionalBadgeRepository.badgeOf('usr-pro', NOW)).resolves.toBeNull();

    rows = [];
    await expect(ProfessionalBadgeRepository.badgeOf('usr-pro', NOW)).resolves.toBeNull();
  });

  it('wraps a row that does not parse', async () => {
    rows = [{ kind: 'pass' }];

    await expect(ProfessionalBadgeRepository.badgeOf('usr-pro', NOW)).rejects.toThrow('Schema mismatch');
  });
});
