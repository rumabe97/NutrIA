import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConflictError, QuotaExceededError } from 'core/entities/Error';
import { allowancesFor } from 'core/domain/Allowance';

import { EventController } from './EventController';

import type { AddEvent, Event } from 'core/entities/Event';
import type { Tier } from 'core/domain/Allowance';

type Range = { readonly from: string; readonly to: string };
type Quota = (dated: readonly Event[]) => Promise<boolean>;

const createWithinQuota = vi.fn<(userId: string, event: AddEvent, range: Range, quota: Quota) => Promise<Event>>();
const findUpcoming = vi.fn<(userId: string, today: string) => Promise<readonly Event[]>>();
const findActive = vi.fn<(userId: string) => Promise<{ endDate: string; startDate: string } | undefined>>();
const tierOf = vi.fn<(userId: string) => Promise<Tier>>();

/**
 * What `EventRepository.createWithinQuota` reads fresh inside its lock — the
 * events already in the window it is asked about. Standing in here for the
 * real transaction the unit test does not open: this suite is about what the
 * controller threads through (the window, the fresh tier), not about the
 * lock itself, which is `EventRepository`'s own concern.
 */
let dated: readonly Event[] = [];

vi.mock('#repositories/Event', () => ({
  EventRepository: {
    createWithinQuota: (u: string, e: AddEvent, r: Range, q: Quota) => createWithinQuota(u, e, r, q),
    findUpcoming: (u: string, d: string) => findUpcoming(u, d)
  }
}));

vi.mock('#repositories/Plan', () => ({ PlanRepository: { findActive: (u: string) => findActive(u) } }));

/*
 * The tier is the real controller's decision — flag first, then column — and
 * this suite is not about that. The switch is on and the column is what a
 * case says, so `tierOf` and `eventStanding` both stay real: the count and
 * the cap are what is actually under test.
 */
vi.mock('core/controllers/Settings', () => ({ SettingsController: { flags: () => Promise.resolve({ automaticActivation: true, premium: true }) } }));
vi.mock('#repositories/User', () => ({ UserRepository: { tierOf: (u: string) => tierOf(u) } }));

const TODAY = '2026-09-10';

function race(overrides: Partial<Event> = {}): Event {
  return { id: 'evt-1', carbs: 'up', daysBefore: 2, fat: 'same', name: 'Media maratón', on: '2026-09-20', protein: 'same', ...overrides };
}

/** Distinct, non-overlapping events inside the fortnight from TODAY, as many as asked. */
function fortnightOf(count: number): readonly Event[] {
  return Array.from({ length: count }, (_none, index) =>
    race({ id: `evt-${index}`, daysBefore: 1, on: `2026-09-${String(12 + index * 2).padStart(2, '0')}` })
  );
}

describe('EventController.add — the cap on events per plan', () => {
  beforeEach(() => {
    createWithinQuota.mockReset();
    findActive.mockReset();
    findUpcoming.mockReset();
    tierOf.mockReset();

    findActive.mockResolvedValue(undefined);
    findUpcoming.mockResolvedValue([]);
    tierOf.mockResolvedValue('free');
    dated = [];
    // Stands in for the repository's own lock and re-read: asks `quota` the
    // same question it would ask inside the transaction, against whatever
    // `dated` the test set up, and mirrors the real refusal on `false`.
    createWithinQuota.mockImplementation(async (_user, event, _range, quota) => {
      if (!(await quota(dated))) {
        throw new QuotaExceededError('event');
      }

      return { id: 'evt-new', ...event };
    });
  });

  it('accepts an event while the fortnight has room', async () => {
    const limit = allowancesFor('free').eventsPerPlan;

    dated = fortnightOf(limit - 1);

    await expect(EventController.add('usr-1', race(), TODAY)).resolves.toMatchObject({ name: 'Media maratón' });
    expect(createWithinQuota).toHaveBeenCalledOnce();
  });

  it('refuses the event past the cap with the allowance code, not a conflict', async () => {
    dated = fortnightOf(allowancesFor('free').eventsPerPlan);

    await expect(EventController.add('usr-1', race(), TODAY)).rejects.toMatchObject({ kind: 'event' });
    await expect(EventController.add('usr-1', race(), TODAY)).rejects.toBeInstanceOf(QuotaExceededError);
  });

  it('gives premium its own, larger number', async () => {
    tierOf.mockResolvedValue('premium');
    dated = fortnightOf(allowancesFor('free').eventsPerPlan);

    await expect(EventController.add('usr-1', race(), TODAY)).resolves.toBeDefined();
    expect(createWithinQuota).toHaveBeenCalledOnce();
  });

  it('reads the tier fresh at the moment quota is decided, not once up front', async () => {
    // Round-2's own gap: a tier captured before the repository's retry loop
    // would judge every attempt by the tier at the *first* try. The controller
    // must instead ask again each time `quota` runs, so a tier that changes
    // between attempts is honoured, not missed.
    dated = fortnightOf(allowancesFor('free').eventsPerPlan);
    tierOf.mockResolvedValueOnce('free').mockResolvedValueOnce('premium');

    createWithinQuota.mockImplementation(async (_user, event, _range, quota) => {
      await quota(dated); // first attempt: still 'free', refused
      const secondTry = await quota(dated); // second attempt: now 'premium', room enough

      if (!secondTry) {
        throw new QuotaExceededError('event');
      }

      return { id: 'evt-new', ...event };
    });

    await expect(EventController.add('usr-1', race(), TODAY)).resolves.toBeDefined();
    expect(tierOf).toHaveBeenCalledTimes(2);
  });

  it('counts against the active plan’s own days when there is one', async () => {
    findActive.mockResolvedValue({ endDate: '2026-09-21', startDate: '2026-09-08' });
    dated = [];

    await EventController.add('usr-1', race(), TODAY);

    // Widened by the longest load, so an event just past the end still counts
    // when its days fall inside; the domain filter then decides which do.
    const [, , range] = createWithinQuota.mock.calls[0] ?? [];

    expect(range).toEqual({ from: '2026-09-08', to: '2026-09-24' });
  });

  it('counts against the fortnight from today when there is no plan', async () => {
    dated = [];

    await EventController.add('usr-1', race(), TODAY);

    const [, , range] = createWithinQuota.mock.calls[0] ?? [];

    expect(range).toEqual({ from: TODAY, to: '2026-09-26' });
  });

  it('does not count an event whose load lies outside the window', async () => {
    // Three events on the days after the fortnight: none loads a day inside it.
    dated = [
      race({ id: 'a', daysBefore: 1, on: '2026-09-26' }),
      race({ id: 'b', daysBefore: 1, on: '2026-09-28' }),
      race({ id: 'c', daysBefore: 1, on: '2026-09-30' })
    ];

    await expect(EventController.add('usr-1', race({ on: '2026-09-15' }), TODAY)).resolves.toBeDefined();
  });

  it('holds an event the week after next to that fortnight’s number, not this one’s', async () => {
    // The fortnight it lands in (24 Sep – 7 Oct) is already full.
    dated = [
      race({ id: 'a', daysBefore: 1, on: '2026-09-26' }),
      race({ id: 'b', daysBefore: 1, on: '2026-09-28' }),
      race({ id: 'c', daysBefore: 1, on: '2026-09-30' })
    ];

    await expect(EventController.add('usr-1', race({ daysBefore: 1, on: '2026-10-05' }), TODAY)).rejects.toBeInstanceOf(QuotaExceededError);

    const [, , range] = createWithinQuota.mock.calls.at(-1) ?? [];

    expect(range).toEqual({ from: '2026-09-24', to: '2026-10-10' });
  });

  it('still refuses an overlap before it ever counts', async () => {
    findUpcoming.mockResolvedValue([race({ on: '2026-09-20' })]);

    await expect(EventController.add('usr-1', race({ on: '2026-09-21' }), TODAY)).rejects.toBeInstanceOf(ConflictError);
    expect(createWithinQuota).not.toHaveBeenCalled();
  });
});
