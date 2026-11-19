import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';

import { professionalBadgeChecks, professionals } from 'database/schema/professional';

import { dueDate, ProfessionalBadgeRepository } from './ProfessionalBadgeRepository';
import { ProfessionalRepository } from './ProfessionalRepository';

import type { ProfessionalBadgeCheck } from 'core/entities/Professional';
import type { SQL } from 'drizzle-orm';

/*
 * Project 025 phase 5, review round two (P2-A): a badge that comes back must not
 * find a `full` link the client has not consented to afresh. The writer of a
 * `pass` — the owner's confirmation; the 004 grant was the other until phase 6
 * retired it — runs the hook the controller hands it
 * (`CareRepository.narrowLinksOf`) inside its own transaction, before the pass,
 * and only when no badge stood just before it. A
 * fake that answers each awaited statement from a script, in order, and keeps
 * the order things happened in. That Postgres narrows the rows is the end-to-end
 * suite's to prove.
 */

interface Chain extends PromiseLike<unknown> {
  for: () => Chain;
  from: () => Chain;
  limit: () => Chain;
  onConflictDoNothing: () => Chain;
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
    onConflictDoNothing: () => link,
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

/** Each lock statement, as Postgres would read it. */
const locks: { readonly params: unknown[]; readonly sql: string }[] = [];
const dialect = new PgDialect({ casing: 'snake_case' });

const tx = {
  delete: (table: unknown) => chain(table === professionals ? 'delete professional' : 'delete'),
  execute: async (statement: SQL) => {
    events.push('lock');
    locks.push(dialect.sqlToQuery(statement));

    return [{ held: true }];
  },
  insert: (table: unknown) => chain(table === professionalBadgeChecks ? 'insert check' : table === professionals ? 'upsert professional' : 'insert'),
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
  locks.length = 0;
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
    expect(events.indexOf('narrow')).toBeLessThan(events.indexOf('insert check'));
    expect(events[0]).toBe('lock');
  });

  it('after a `fail` on a renewal, and a new application: narrows before the pass', async () => {
    confirming([check('pass', 300), check('applied', 20), check('fail', 10), check('applied', 2)], true);

    await expect(ProfessionalBadgeRepository.confirm('usr-pro', 'usr-owner', NOW, narrow)).resolves.not.toBeNull();

    expect(narrow).toHaveBeenCalledExactlyOnceWith(tx);
    expect(events.indexOf('narrow')).toBeLessThan(events.indexOf('insert check'));
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
    expect(events).toContain('insert check');
  });

  it('narrows nothing, and writes nothing, when there is nothing to confirm', async () => {
    // An application whose code was never entered: no pass.
    confirming([check('applied', 2)], false);

    await expect(ProfessionalBadgeRepository.confirm('usr-pro', 'usr-owner', NOW, narrow)).resolves.toBeNull();

    expect(narrow).not.toHaveBeenCalled();
    expect(events).not.toContain('insert check');
  });
});

/*
 * Project 025 phase 6 retired the 004 grant (`POST /admin/accounts/:id/professional`):
 * `confirm` is now the **only** writer of a `pass`, so the narrow-before-pass guard
 * above is the whole of it. Pinned, so a second writer cannot come back unnoticed.
 */
describe('the 004 grant is gone — `confirm` is the one writer of a pass', () => {
  it('has no grant on the practice’s repository', () => {
    expect(Object.keys(ProfessionalRepository)).not.toContain('grant');
    expect(Object.keys(ProfessionalRepository)).not.toContain('revoke');
  });
});

/*
 * Phase 6 step 0: the close of a practice — the 004 revoke reshaped — withdraws a
 * standing badge before it deletes the row, under the badge lock taken first, and
 * runs the controller's hook (the links' narrowing, the profile's requeue) right
 * after the `withdrawn`, in the same transaction.
 */
/** The close that stands, as `practice_restrictions` holds it: its day come. */
const CLOSING = {
  id: '00000000-0000-4000-8000-0000000c1053',
  actedAt: new Date(NOW.getTime() - 31 * DAY),
  actedBy: 'usr-owner',
  createdAt: new Date(NOW.getTime() - 31 * DAY),
  effectiveAt: new Date(NOW.getTime() - DAY),
  kind: 'closing' as const,
  reason: 'facts',
  updatedAt: new Date(NOW.getTime() - 31 * DAY),
  userId: 'usr-pro'
};

describe('ProfessionalRepository.close — the links ended, the badge withdrawn, in the close’s transaction', () => {
  const ended = vi.fn(async (_tx: unknown) => {
    events.push('end links');
  });

  beforeEach(() => {
    ended.mockClear();
  });

  it('takes the lock, ends the links, withdraws a standing badge, runs its hook, then deletes the practice and its invitations', async () => {
    // The practice row, the checks (a badge standing), the codes expired, the `withdrawn`, then the two deletes.
    script = [[{ id: 'pro-row' }], [CLOSING], [check('pass', 30)], [], [], [], []];

    await expect(
      ProfessionalRepository.close(
        'usr-pro',
        CLOSING.id,
        NOW,
        { checkedBy: 'usr-owner', reason: 'other: facts' },
        { endLinks: ended, whenWithdrawn: narrow }
      )
    ).resolves.toBe(true);

    expect(events[0]).toBe('lock');
    expect(ended).toHaveBeenCalledExactlyOnceWith(tx);
    expect(narrow).toHaveBeenCalledExactlyOnceWith(tx);
    // The links end with the practice row held and before it goes; the badge after, then its hook.
    expect(events.indexOf('end links')).toBeLessThan(events.indexOf('insert check'));
    expect(events.indexOf('insert check')).toBeLessThan(events.indexOf('narrow'));
    expect(events.indexOf('narrow')).toBeLessThan(events.indexOf('delete professional'));
    expect(events.at(-1)).toBe('delete');
  });

  it('with no badge standing, still ends the links and closes, and withdraws nothing', async () => {
    script = [[{ id: 'pro-row' }], [CLOSING], [check('withdrawn', 3), check('pass', 30)], [], []];

    await expect(
      ProfessionalRepository.close('usr-pro', CLOSING.id, NOW, { checkedBy: null, reason: 'other' }, { endLinks: ended, whenWithdrawn: narrow })
    ).resolves.toBe(true);

    expect(ended).toHaveBeenCalledOnce();
    expect(narrow).not.toHaveBeenCalled();
    expect(events).not.toContain('insert check');
    expect(events).toContain('delete professional');
  });

  it('with no practice left, writes nothing and ends nothing', async () => {
    script = [[], [CLOSING]];

    await expect(
      ProfessionalRepository.close('usr-pro', CLOSING.id, NOW, { checkedBy: null, reason: 'other' }, { endLinks: ended, whenWithdrawn: narrow })
    ).resolves.toBe(false);

    expect(ended).not.toHaveBeenCalled();
    expect(events).not.toContain('insert check');
    expect(events).not.toContain('delete professional');
  });

  /*
   * Invariant review of phase 6, P1-3: the sweep lists its closes outside any lock, so the
   * close is read again under it — a close the owner lifted in between, or replaced, or
   * whose day has not come, is not carried out, and nothing is written.
   */
  it.each([
    [
      'lifted since the list',
      [
        CLOSING,
        { ...CLOSING, id: '00000000-0000-4000-8000-00000000a1f7', actedAt: NOW, createdAt: NOW, effectiveAt: null, kind: 'lifted', reason: null }
      ]
    ],
    ['replaced by another close', [{ ...CLOSING, id: '00000000-0000-4000-8000-000000000002' }]],
    ['whose day has not come', [{ ...CLOSING, effectiveAt: new Date(NOW.getTime() + DAY) }]]
  ])('carries out nothing for a close %s', async (_case, restrictions) => {
    script = [[{ id: 'pro-row' }], restrictions];

    await expect(
      ProfessionalRepository.close('usr-pro', CLOSING.id, NOW, { checkedBy: null, reason: 'other' }, { endLinks: ended, whenWithdrawn: narrow })
    ).resolves.toBe(false);

    expect(ended).not.toHaveBeenCalled();
    expect(events).not.toContain('insert check');
    expect(events).not.toContain('delete professional');
  });

  it('records the close carried out last, in its transaction', async () => {
    const record = vi.fn(async (_tx: unknown) => {
      events.push('record');
    });

    script = [[{ id: 'pro-row' }], [CLOSING], [], [], []];

    await ProfessionalRepository.close('usr-pro', CLOSING.id, NOW, { checkedBy: null, reason: 'other' }, { endLinks: ended, record });

    expect(record).toHaveBeenCalledExactlyOnceWith(tx);
    expect(events.at(-1)).toBe('record');
  });
});

/*
 * Review of the end-to-end run (commit 02919584): the consent writes and the
 * badge writes queue on one lock. Its one definition is `badgeLockKey`; what is
 * pinned here is that opening a practice and closing one take it first — before
 * the `professionals` row — and that it is the very key `confirm`/`remove` try
 * under `underLock`.
 */
describe('the practitioner’s badge lock — one key for every writer', () => {
  const KEY = { params: ['usr-pro'], sql: "hashtext('professional_badge'), hashtext($1)" };

  it('opening a practice takes it, waiting, before anything else it reads or writes', async () => {
    script = [[{ id: 'pro-row' }]];

    await ProfessionalRepository.open('usr-pro', { birthDate: null, locale: null }, NOW, async () => {
      events.push('barred?');

      return false;
    });

    expect(events[0]).toBe('lock');
    expect(events.indexOf('lock')).toBeLessThan(events.indexOf('barred?'));
    expect(events.indexOf('barred?')).toBeLessThan(events.indexOf('upsert professional'));
    expect(locks[0]).toMatchObject({ params: KEY.params, sql: `select pg_advisory_xact_lock(${KEY.sql})` });
  });

  it('`lock` takes it, waiting; `confirm` tries the same key', async () => {
    await ProfessionalBadgeRepository.lock(tx as never, 'usr-pro');

    script = [[check('pass', 350)], [], [], [written()]];
    await ProfessionalBadgeRepository.confirm('usr-pro', 'usr-owner', NOW);

    expect(locks.map(lock => lock.sql)).toEqual([`select pg_advisory_xact_lock(${KEY.sql})`, `select pg_try_advisory_xact_lock(${KEY.sql}) as held`]);
    expect(locks.map(lock => lock.params)).toEqual([KEY.params, KEY.params]);
  });
});
