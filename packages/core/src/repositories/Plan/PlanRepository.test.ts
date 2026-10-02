import { describe, expect, it, vi } from 'vitest';

import { PlanRepository, refusesProfessionalSave, saveShape } from './PlanRepository';

/** What each `select … for update` answers, in order, and every write the transaction made. */
const selects: unknown[][] = [];
const writes: Record<string, unknown>[] = [];

function chain() {
  const link = { for: () => Promise.resolve(selects.shift() ?? []), from: () => link, limit: () => link, where: () => link };

  return link;
}

const tx = {
  delete: () => ({ where: () => Promise.resolve(writes.push({ deleted: true })) }),
  select: () => chain(),
  update: () => ({ set: (values: Record<string, unknown>) => ({ where: () => Promise.resolve(writes.push(values)) }) })
};

vi.mock('database', () => ({ database: () => ({ transaction: (fn: (t: typeof tx) => Promise<unknown>) => fn(tx) }) }));

/**
 * The save-time rule for a professional's generation (`0060`): it never
 * completes the client's fortnight under way. The SQL around it — the active
 * row read in the plan's own transaction — is covered end to end.
 */
describe('refusesProfessionalSave', () => {
  it('refuses a professional’s plan that would go active over a fortnight still running', () => {
    expect(refusesProfessionalSave({ byProfessional: true, review: false, running: true })).toBe(true);
  });

  it('lets it through when it waits for review, or when nothing runs on its first day — no plan, or one that has ended', () => {
    expect(refusesProfessionalSave({ byProfessional: true, review: true, running: true })).toBe(false);
    expect(refusesProfessionalSave({ byProfessional: true, review: false, running: false })).toBe(false);
  });

  it('never refuses the client’s own generation', () => {
    expect(refusesProfessionalSave({ byProfessional: false, review: false, running: true })).toBe(false);
  });
});

/*
 * How a generated plan is saved (project 015). The SQL around it — the rows
 * read and held in the plan's transaction, the days deleted — is covered end to
 * end; here, every branch of the decision.
 */
describe('saveShape — a plan may wait for its day', () => {
  const TODAY = '2026-10-02';
  const A = { endDate: '2026-10-04' };
  const base = { active: A, counted: undefined, review: false, today: TODAY, waiting: undefined };

  it('starts today as it always did: active, the plan under way completed, a redo while it still runs', () => {
    expect(saveShape({ ...base, start: TODAY })).toEqual({
      completesActive: true,
      cutsActiveTo: null,
      opens: false,
      redo: true,
      replacedRedos: 0,
      replacesWaiting: false,
      status: 'active'
    });
    expect(saveShape({ ...base, active: { endDate: '2026-10-01' }, start: TODAY })).toMatchObject({ redo: false, status: 'active' });
  });

  it('waits as the next fortnight, free, when it starts after the plan under way ends — which stays whole', () => {
    expect(saveShape({ ...base, start: '2026-10-05' })).toEqual({
      completesActive: false,
      cutsActiveTo: null,
      opens: false,
      redo: false,
      replacedRedos: 0,
      replacesWaiting: false,
      status: 'scheduled'
    });
  });

  it('cuts the plan under way to the day before a start inside it, and counts a redo', () => {
    expect(saveShape({ ...base, start: '2026-10-04' })).toMatchObject({
      completesActive: false,
      cutsActiveTo: '2026-10-03',
      opens: false,
      redo: true,
      status: 'scheduled'
    });
    expect(saveShape({ ...base, start: '2026-10-03' })).toMatchObject({ cutsActiveTo: '2026-10-02', redo: true });
  });

  it('waits with no plan under way as a new fortnight', () => {
    expect(saveShape({ ...base, active: undefined, start: '2026-10-06' })).toMatchObject({ cutsActiveTo: null, redo: false, status: 'scheduled' });
  });

  it('replaces a plan already waiting, and that is a redo — the first of the fortnight it opens', () => {
    const waiting = { generationMetadata: { redo: false } };

    expect(saveShape({ ...base, start: '2026-10-05', waiting })).toMatchObject({
      opens: true,
      redo: true,
      replacedRedos: 0,
      replacesWaiting: true,
      status: 'scheduled'
    });
    // Started today instead: the waiting plan goes, the plan under way completes.
    expect(saveShape({ ...base, start: TODAY, waiting })).toMatchObject({ completesActive: true, replacesWaiting: true, status: 'active' });
  });

  it('carries what the replaced plan spent into the fortnight it belongs to, and nothing across fortnights', () => {
    // It had itself replaced the opener: one redo of the next fortnight already spent.
    const opener = { generationMetadata: { opens: true, redo: true } };
    // It had cut the plan under way: a redo of this fortnight.
    const cutter = { generationMetadata: { redo: true, replacedRedos: 1 } };

    expect(saveShape({ ...base, start: '2026-10-05', waiting: opener })).toMatchObject({ opens: true, replacedRedos: 1 });
    expect(saveShape({ ...base, start: '2026-10-04', waiting: opener })).toMatchObject({ opens: false, replacedRedos: 0 });
    expect(saveShape({ ...base, start: '2026-10-04', waiting: cutter })).toMatchObject({ opens: false, replacedRedos: 2 });
    expect(saveShape({ ...base, start: '2026-10-05', waiting: cutter })).toMatchObject({ opens: true, replacedRedos: 0 });
  });

  it('leaves everything standing for a plan that goes to review — the care path is unchanged', () => {
    expect(saveShape({ ...base, review: true, start: '2026-10-05', waiting: { generationMetadata: null } })).toEqual({
      completesActive: false,
      cutsActiveTo: null,
      opens: false,
      redo: false,
      replacedRedos: 0,
      replacesWaiting: false,
      status: 'pending_review'
    });
  });
});

describe('PlanRepository.activateDue — on its day, once', () => {
  it('completes the plan under way the day before and activates the waiting one', async () => {
    writes.length = 0;
    selects.push([{ id: 'plan-2', startDate: '2026-10-05', version: 2 }], [{ version: 1 }]);

    await expect(PlanRepository.activateDue('usr-1', '2026-10-05')).resolves.toBe(true);
    expect(writes).toHaveLength(2);
    expect(writes[0]).toMatchObject({ completedAt: '2026-10-04', status: 'completed' });
    expect(writes[1]).toMatchObject({ status: 'active' });
  });

  it('deletes, never activates, a waiting plan older than the active one — left by a rolled-back release', async () => {
    writes.length = 0;
    selects.push([{ id: 'plan-2', startDate: '2026-10-05', version: 2 }], [{ version: 3 }]);

    await expect(PlanRepository.activateDue('usr-1', '2026-10-05')).resolves.toBe(false);
    // The job is unlinked, the stale row deleted; the active plan is not completed.
    expect(writes).toEqual([{ planId: null }, { deleted: true }]);
  });

  it('changes nothing when nothing is due, so a second run is harmless', async () => {
    writes.length = 0;

    await expect(PlanRepository.activateDue('usr-1', '2026-10-05')).resolves.toBe(false);
    expect(writes).toHaveLength(0);
  });
});
