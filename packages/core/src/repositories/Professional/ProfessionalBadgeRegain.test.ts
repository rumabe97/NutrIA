import { beforeEach, describe, expect, it, vi } from 'vitest';

import { professionalBadgeChecks, professionals } from 'database/schema/professional';

import { dueDate, ProfessionalBadgeRepository } from './ProfessionalBadgeRepository';
import { ProfessionalRepository } from './ProfessionalRepository';

import type { ProfessionalBadgeCheck } from 'core/entities/Professional';

/*
 * Project 025 phase 5, review round two (P2-A): a badge that comes back must not
 * find a `full` link the client has not consented to afresh. Both writers of a
 * `pass` — the owner's confirmation and the 004 grant — run the hook the
 * controller hands them (`CareRepository.narrowLinksOf`) inside their own
 * transaction, before the pass, and only when no badge stood just before it. A
 * fake that answers each awaited statement from a script, in order, and keeps
 * the order things happened in. That Postgres narrows the rows is the end-to-end
 * suite's to prove.
 */

interface Chain extends PromiseLike<unknown> {
  for: () => Chain;
  from: () => Chain;
  limit: () => Chain;
  onConflictDoUpdate: () => Chain;
  orderBy: () => Chain;
  returning: () => Chain;
  set: () => Chain;
  values: (values: Record<string, unknown>) => Chain;
  where: () => Chain;
}

/** What happened, in order: each awaited statement by kind and table, and the hook. */
const events: string[] = [];
/** What each awaited statement answers, in the order they are awaited. */
let script: unknown[][] = [];

function chain(name: string): Chain {
  const link: Chain = {
    for: () => link,
    from: () => link,
    limit: () => link,
    onConflictDoUpdate: () => link,
    orderBy: () => link,
    returning: () => link,
    set: () => link,
    then: (resolve, reject) => {
      events.push(name);

      return Promise.resolve(script.shift() ?? []).then(resolve, reject);
    },
    values: () => link,
    where: () => link
  };

  return link;
}

const tx = {
  execute: async () => {
    events.push('lock');

    return [{ held: true }];
  },
  insert: (table: unknown) => chain(table === professionalBadgeChecks ? 'insert pass' : table === professionals ? 'upsert professional' : 'insert'),
  select: () => chain('select'),
  update: () => chain('update')
};

vi.mock('database', () => ({ database: () => ({ transaction: <T>(fn: (db: unknown) => Promise<T>) => fn(tx) }) }));

const NOW = new Date('2026-11-19T09:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;
let sequence = 0;

function check(kind: ProfessionalBadgeCheck['kind'], days: number): ProfessionalBadgeCheck {
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
    userId: 'usr-pro'
  };
}

/** The pass the confirmation writes, as `RETURNING` answers it. */
function written(): ProfessionalBadgeCheck {
  return { ...check('pass', 0), checkedAt: NOW, dueAt: dueDate(NOW) };
}

const narrow = vi.fn(async (_tx: unknown) => {
  events.push('narrow');
});

beforeEach(() => {
  events.length = 0;
  script = [];
  narrow.mockClear();
});

describe('ProfessionalBadgeRepository.confirm — a badge that comes back narrows first', () => {
  /** The confirmation's reads after the lock: the checks, then the code entered for the check it proves. */
  function confirming(checks: readonly ProfessionalBadgeCheck[], entered: boolean): void {
    script = [[...checks], entered ? [{ channel: 'register_email' }] : [], [], [written()]];
  }

  it('after a lapse by the clock, not yet swept, and a new application: narrows in the same transaction, before the pass', async () => {
    // A pass fourteen months old: twelve to its due date, thirty days of grace, and past both.
    confirming([check('pass', 430), check('applied', 3)], true);

    await expect(ProfessionalBadgeRepository.confirm('usr-pro', 'usr-owner', NOW, narrow)).resolves.not.toBeNull();

    expect(narrow).toHaveBeenCalledExactlyOnceWith(tx);
    expect(events.indexOf('narrow')).toBeLessThan(events.indexOf('insert pass'));
    expect(events[0]).toBe('lock');
  });

  it('after a `fail` on a renewal, and a new application: narrows before the pass', async () => {
    confirming([check('pass', 300), check('applied', 20), check('fail', 10), check('applied', 2)], true);

    await expect(ProfessionalBadgeRepository.confirm('usr-pro', 'usr-owner', NOW, narrow)).resolves.not.toBeNull();

    expect(narrow).toHaveBeenCalledExactlyOnceWith(tx);
    expect(events.indexOf('narrow')).toBeLessThan(events.indexOf('insert pass'));
  });

  it('a first-ever badge narrows too — harmless: a link accepted without a badge is `plan` already', async () => {
    confirming([check('applied', 2)], true);

    await ProfessionalBadgeRepository.confirm('usr-pro', 'usr-owner', NOW, narrow);

    expect(narrow).toHaveBeenCalledOnce();
  });

  it('a renewal under a standing badge narrows nothing', async () => {
    confirming([check('pass', 350)], false);

    await expect(ProfessionalBadgeRepository.confirm('usr-pro', 'usr-owner', NOW, narrow)).resolves.not.toBeNull();

    expect(narrow).not.toHaveBeenCalled();
    expect(events).toContain('insert pass');
  });

  it('narrows nothing, and writes nothing, when there is nothing to confirm', async () => {
    // An application whose code was never entered: no pass.
    confirming([check('applied', 2)], false);

    await expect(ProfessionalBadgeRepository.confirm('usr-pro', 'usr-owner', NOW, narrow)).resolves.toBeNull();

    expect(narrow).not.toHaveBeenCalled();
    expect(events).not.toContain('insert pass');
  });
});

describe('ProfessionalRepository.grant — the 004 grant route writes a pass too', () => {
  const PROFESSIONAL = {
    id: '00000000-0000-4000-8000-0000000000aa',
    agreementAcceptedAt: null,
    agreementVersion: null,
    collegiateNumber: 'MAD00123',
    createdAt: NOW,
    grantedAt: NOW,
    grantedBy: 'usr-owner',
    includedClients: 30,
    practiceOpen: false,
    updatedAt: NOW,
    userId: 'usr-pro'
  };

  it('after a lapse by the clock, not yet swept: narrows in the grant’s transaction, before the pass', async () => {
    // The upsert, then the badge read on the grant's own connection: the latest decisive check, a pass long past.
    script = [[PROFESSIONAL], [check('pass', 430)], [], []];

    await ProfessionalRepository.grant('usr-pro', 'MAD00123', 'usr-owner', undefined, narrow);

    expect(narrow).toHaveBeenCalledExactlyOnceWith(tx);
    expect(events.indexOf('narrow')).toBeLessThan(events.indexOf('insert pass'));
  });

  it('a grant again under a standing badge — a corrected number — narrows nothing', async () => {
    script = [[PROFESSIONAL], [check('pass', 30)], [], []];

    await ProfessionalRepository.grant('usr-pro', 'MAD00124', 'usr-owner', undefined, narrow);

    expect(narrow).not.toHaveBeenCalled();
    expect(events).toContain('insert pass');
  });
});
