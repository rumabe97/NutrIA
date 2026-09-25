import { describe, expect, it } from 'vitest';

import { groupCareAccessEntries } from './careAccessGroups';

import type { CareAccessEntryView } from 'core/controllers/Care';

let seq = 0;

function entry(overrides: Partial<CareAccessEntryView> = {}): CareAccessEntryView {
  seq += 1;

  return { id: `entry-${seq}`, action: 'read', at: '2026-09-25T10:00:00.000Z', kind: 'plan', professionalName: 'Ana Dietista', ...overrides };
}

describe('groupCareAccessEntries', () => {
  it('keeps a single entry as a plain row, not a group of one', () => {
    const only = entry();

    expect(groupCareAccessEntries([only])).toEqual([{ entry: only, kind: 'entry' }]);
  });

  it('folds consecutive reads from the same professional and kind, newest first, into one group', () => {
    const entries = [entry({ at: '2026-09-25T10:05:00.000Z' }), entry({ at: '2026-09-25T10:03:00.000Z' }), entry({ at: '2026-09-25T10:02:00.000Z' })];

    const rows = groupCareAccessEntries(entries);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ entries, kind: 'group' });
  });

  it('groups a gap of exactly ten minutes', () => {
    const entries = [entry({ at: '2026-09-25T10:10:00.000Z' }), entry({ at: '2026-09-25T10:00:00.000Z' })];

    const rows = groupCareAccessEntries(entries);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.kind).toBe('group');
  });

  it('splits on a gap one second past ten minutes', () => {
    const entries = [entry({ at: '2026-09-25T10:10:01.000Z' }), entry({ at: '2026-09-25T10:00:00.000Z' })];

    const rows = groupCareAccessEntries(entries);

    expect(rows).toHaveLength(2);
    expect(rows.every(row => row.kind === 'entry')).toBe(true);
  });

  it('breaks the run on a different kind even from the same professional, seconds apart', () => {
    const entries = [entry({ at: '2026-09-25T10:00:05.000Z', kind: 'overview' }), entry({ at: '2026-09-25T10:00:00.000Z', kind: 'plan' })];

    const rows = groupCareAccessEntries(entries);

    expect(rows).toHaveLength(2);
    expect(rows.every(row => row.kind === 'entry')).toBe(true);
  });

  it('breaks the run on a different professional, seconds apart', () => {
    const entries = [
      entry({ at: '2026-09-25T10:00:05.000Z', professionalName: 'Ana Dietista' }),
      entry({ at: '2026-09-25T10:00:00.000Z', professionalName: 'Luis Nutricionista' })
    ];

    const rows = groupCareAccessEntries(entries);

    expect(rows).toHaveLength(2);
    expect(rows.every(row => row.kind === 'entry')).toBe(true);
  });

  it('never folds a write into a run of reads, even same professional, kind and minute', () => {
    const entries = [entry({ action: 'write', at: '2026-09-25T10:00:05.000Z' }), entry({ action: 'read', at: '2026-09-25T10:00:00.000Z' })];

    const rows = groupCareAccessEntries(entries);

    expect(rows).toHaveLength(2);
    expect(rows.map(row => row.kind)).toEqual(['entry', 'entry']);
  });

  it('continues one run across what were two loaded pages, once both share an array', () => {
    // `loadMore` appends the next page to the same list the log already
    // holds; grouping only ever sees the concatenated result, so a run that
    // crossed the `before` cursor keeps folding into one group here too.
    const pageOne = [entry({ at: '2026-09-25T10:06:00.000Z' }), entry({ at: '2026-09-25T10:04:00.000Z' })];
    const pageTwo = [entry({ at: '2026-09-25T10:02:00.000Z' })];

    const rows = groupCareAccessEntries([...pageOne, ...pageTwo]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ entries: [...pageOne, ...pageTwo], kind: 'group' });
  });

  it('keeps unrelated single rows apart, each its own entry', () => {
    const entries = [entry({ at: '2026-09-25T12:00:00.000Z', kind: 'targets' }), entry({ at: '2026-09-25T09:00:00.000Z', kind: 'health' })];

    const rows = groupCareAccessEntries(entries);

    expect(rows).toEqual([
      { entry: entries[0], kind: 'entry' },
      { entry: entries[1], kind: 'entry' }
    ]);
  });

  it('drops no row and reorders none: flattening every row back gives the input, id for id, in order', () => {
    // The invariant grouping exists to preserve: it only ever folds a run's
    // display, `care_access_log` (and this function) never loses a row. A mix
    // of a run, a lone write and a lone read, so both row kinds are exercised.
    const entries = [
      entry({ at: '2026-09-25T10:05:00.000Z' }),
      entry({ at: '2026-09-25T10:03:00.000Z' }),
      entry({ action: 'write', at: '2026-09-25T09:00:00.000Z', kind: 'targets' }),
      entry({ at: '2026-09-25T08:00:00.000Z', kind: 'health' })
    ];

    const rows = groupCareAccessEntries(entries);
    const flattened = rows.flatMap(row => (row.kind === 'entry' ? [row.entry] : row.entries));

    expect(flattened.map(item => item.id)).toEqual(entries.map(item => item.id));
  });
});
