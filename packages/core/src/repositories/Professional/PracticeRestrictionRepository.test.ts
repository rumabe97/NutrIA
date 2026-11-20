import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';

import type { SQL } from 'drizzle-orm';

import { barsOpening, blocksPractice, PracticeRestrictionRepository, restrictionFrom, UNRESTRICTED } from './PracticeRestrictionRepository';

import type { PracticeRestriction, PracticeRestrictionKind } from 'core/entities/Professional';

const NOW = new Date('2026-11-19T09:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;
let sequence = 0;

function row(kind: PracticeRestrictionKind, daysAgo: number, effectiveInDays: number | null = null): PracticeRestriction {
  sequence += 1;
  const at = new Date(NOW.getTime() - daysAgo * DAY);

  return {
    id: `00000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`,
    actedAt: at,
    actedBy: 'usr-owner',
    createdAt: new Date(at.getTime() + sequence),
    effectiveAt: effectiveInDays === null ? null : new Date(NOW.getTime() + effectiveInDays * DAY),
    kind,
    reason: kind === 'lifted' ? null : `reason ${String(sequence)}`,
    updatedAt: at,
    userId: 'usr-pro'
  };
}

/*
 * PRD 025 scope 16 and criterion 24: the one definition of what stands against
 * an account as a practitioner. A suspension and a close can stand together
 * (`textos/06` § W bis.3, «es decir, suspendida»); a lift ends both.
 */
describe('restrictionFrom — the one definition', () => {
  it('is nothing for an account the owner never acted on', () => {
    expect(restrictionFrom([])).toEqual(UNRESTRICTED);
  });

  it('a suspension stands from its row, with its statement', () => {
    const suspension = row('suspended', 2);

    expect(restrictionFrom([suspension])).toEqual({ closing: null, suspended: { actedAt: suspension.actedAt, reason: suspension.reason } });
  });

  it('a close decided on a suspended practice leaves it suspended', () => {
    const standing = restrictionFrom([row('suspended', 5), row('closing', 1, 29)]);

    expect(standing.suspended).not.toBeNull();
    expect(standing.closing?.effectiveAt).toEqual(new Date(NOW.getTime() + 29 * DAY));
  });

  it('a lift ends both, and a later suspension stands again', () => {
    expect(restrictionFrom([row('suspended', 5), row('closing', 4, 26), row('lifted', 3)])).toEqual(UNRESTRICTED);
    expect(restrictionFrom([row('suspended', 5), row('lifted', 3), row('suspended', 1)]).suspended).not.toBeNull();
  });

  it('reads the rows in the order the owner acted, whatever order they come in', () => {
    const rows = [row('lifted', 1), row('suspended', 3)];

    expect(restrictionFrom(rows)).toEqual(UNRESTRICTED);
    expect(restrictionFrom([...rows].reverse())).toEqual(UNRESTRICTED);
  });

  it('a `closing` read without its date decides nothing (the table refuses one)', () => {
    expect(restrictionFrom([{ ...row('closing', 1, 29), effectiveAt: null }])).toEqual(UNRESTRICTED);
  });
});

describe('blocksPractice and barsOpening', () => {
  it.each([
    ['nothing', [], false, false],
    ['a suspension', [row('suspended', 1)], true, true],
    ['a close whose day has not come: the practice works until then', [row('closing', 1, 10)], false, true],
    ['a close whose day has come, the sweep not run yet', [row('closing', 31, 0)], true, true],
    ['a closed practice', [row('closing', 60, -30)], true, true],
    ['a suspension lifted', [row('suspended', 3), row('lifted', 1)], false, false]
  ])('%s → refuses client routes: %s, bars opening: %s', (_label, rows, blocks, bars) => {
    const standing = restrictionFrom(rows);

    expect(blocksPractice(standing, NOW)).toBe(blocks);
    expect(barsOpening(standing)).toBe(bars);
  });
});

/** A transaction that answers each awaited statement from a script, and records what happened. */
const events: string[] = [];
let script: unknown[][] = [];
const inserted: Record<string, unknown>[] = [];

function chain(name: string): PromiseLike<unknown> & Record<string, unknown> {
  const link: PromiseLike<unknown> & Record<string, unknown> = {
    from: () => link,
    innerJoin: () => link,
    limit: () => link,
    orderBy: () => link,
    then: (resolve, reject) => {
      events.push(name);

      return Promise.resolve(script.shift() ?? []).then(resolve, reject);
    },
    values: (values: Record<string, unknown>) => {
      inserted.push(values);

      return link;
    },
    where: () => link
  };

  return link;
}

const tx = {
  execute: async () => {
    events.push('lock');

    return [];
  },
  insert: () => chain('insert'),
  select: () => chain('select')
};

vi.mock('database', () => ({ database: () => ({ select: () => chain('select'), transaction: <T>(fn: (db: unknown) => Promise<T>) => fn(tx) }) }));

beforeEach(() => {
  events.length = 0;
  inserted.length = 0;
  script = [];
});

describe('PracticeRestrictionRepository.act — one decision on what stands, under the practitioner’s lock', () => {
  const SUSPEND = { actedBy: 'usr-owner', effectiveAt: null, kind: 'suspended' as const, reason: 'facts' };

  it('takes the badge lock first, reads what stands and whether a practice exists, then writes the row', async () => {
    // The standing (no rows), the practice row; then the standing again after the insert.
    script = [[], [{ id: 'pro-row' }], [], [row('suspended', 0)]];
    const decide = vi.fn(() => true);

    const record = vi.fn(async (_tx: unknown, _act: unknown) => {
      events.push('record');
    });

    const act = await PracticeRestrictionRepository.act('usr-pro', SUSPEND, decide, record);

    expect(events[0]).toBe('lock');
    expect(decide).toHaveBeenCalledWith(UNRESTRICTED, true);
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({ ...SUSPEND, userId: 'usr-pro' });
    // The database's clock, read once the lock is held (invariant review of phase 6, P3): never an app clock from before the wait.
    expect(new PgDialect({ casing: 'snake_case' }).sqlToQuery(inserted[0]?.actedAt as SQL).sql).toBe('clock_timestamp()');
    expect(act).toMatchObject({ before: UNRESTRICTED, practising: true });
    expect(act?.after.suspended).not.toBeNull();
    // The audit row in the same transaction, after the write.
    expect(record).toHaveBeenCalledExactlyOnceWith(tx, act);
    expect(events.at(-1)).toBe('record');
  });

  it('writes nothing when the decision refuses', async () => {
    script = [[], []];

    await expect(PracticeRestrictionRepository.act('usr-pro', SUSPEND, (_standing, practising) => practising)).resolves.toBeNull();
    expect(inserted).toEqual([]);
  });
});

/*
 * Phase 9 review: an account closed, lifted, closed again and carried out must
 * stay on the owner's list. Every reader folds the account's rows by the one
 * definition, so the close that stands after `closing(A) → lifted → closing(B)`
 * is B — even when A's day was also moved into the past, as the local probe's
 * update moves every `closing` row of the account.
 */
describe('a close lifted, then a new close: every reader sees the new one', () => {
  function history(): { readonly a: PracticeRestriction; readonly b: PracticeRestriction; readonly rows: PracticeRestriction[] } {
    // Both days in the past: A's moved there too, as `update … where kind = 'closing'` does.
    const a = row('closing', 40, -10);
    const lifted = row('lifted', 35);
    const b = row('closing', 5, -1);

    return { a, b, rows: [a, lifted, b] };
  }

  it('the fold stands on B, whatever order the rows arrive in', () => {
    const { b, rows } = history();

    expect(restrictionFrom(rows).closing?.id).toBe(b.id);
    expect(restrictionFrom([...rows].reverse()).closing?.id).toBe(b.id);
  });

  it('the daily sweep is handed B, never A', async () => {
    const { b, rows } = history();

    script = [rows.map(own => ({ row: own }))];

    await expect(PracticeRestrictionRepository.dueClosings(NOW)).resolves.toEqual([
      { closing: { id: b.id, actedAt: b.actedAt, actedBy: b.actedBy, effectiveAt: b.effectiveAt, reason: b.reason }, userId: 'usr-pro' }
    ]);
  });

  it('once B is carried out, the owner’s list still finds the account: B stands', async () => {
    const { b, rows } = history();

    script = [[...rows].reverse()];

    const standings = await PracticeRestrictionRepository.standings(['usr-pro']);

    expect(standings.get('usr-pro')?.closing?.id).toBe(b.id);
  });

  it('an account whose only close was lifted is not on it: nothing stands to lift', async () => {
    script = [[row('closing', 40, -10), row('lifted', 35)]];

    await expect(PracticeRestrictionRepository.standings(['usr-pro'])).resolves.toEqual(new Map());
  });
});
