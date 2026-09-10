import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConflictError, QuotaExceededError } from 'core/entities/Error';
import { allowancesFor } from 'core/domain/Allowance';

import { EventController } from './EventController';

import type { AddEvent, Event } from 'core/entities/Event';
import type { Tier } from 'core/domain/Allowance';

const create = vi.fn<(userId: string, event: AddEvent) => Promise<Event>>();
const findInRange = vi.fn<(userId: string, from: string, to: string) => Promise<readonly Event[]>>();
const findUpcoming = vi.fn<(userId: string, today: string) => Promise<readonly Event[]>>();
const findActive = vi.fn<(userId: string) => Promise<{ endDate: string; startDate: string } | undefined>>();
const tierOf = vi.fn<(userId: string) => Promise<Tier>>();

vi.mock('#repositories/Event', () => ({
  EventRepository: {
    create: (u: string, e: AddEvent) => create(u, e),
    findInRange: (u: string, f: string, t: string) => findInRange(u, f, t),
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
    create.mockReset();
    findActive.mockReset();
    findInRange.mockReset();
    findUpcoming.mockReset();
    tierOf.mockReset();

    findActive.mockResolvedValue(undefined);
    findUpcoming.mockResolvedValue([]);
    tierOf.mockResolvedValue('free');
    create.mockImplementation((_user, event) => Promise.resolve({ id: 'evt-new', ...event }));
  });

  it('accepts an event while the fortnight has room', async () => {
    const limit = allowancesFor('free').eventsPerPlan;

    findInRange.mockResolvedValue(fortnightOf(limit - 1));

    await expect(EventController.add('usr-1', race(), TODAY)).resolves.toMatchObject({ name: 'Media maratón' });
    expect(create).toHaveBeenCalledOnce();
  });

  it('refuses the event past the cap with the allowance code, not a conflict', async () => {
    findInRange.mockResolvedValue(fortnightOf(allowancesFor('free').eventsPerPlan));

    await expect(EventController.add('usr-1', race(), TODAY)).rejects.toMatchObject({ kind: 'event' });
    await expect(EventController.add('usr-1', race(), TODAY)).rejects.toBeInstanceOf(QuotaExceededError);
    expect(create).not.toHaveBeenCalled();
  });

  it('gives premium its own, larger number', async () => {
    tierOf.mockResolvedValue('premium');
    findInRange.mockResolvedValue(fortnightOf(allowancesFor('free').eventsPerPlan));

    await expect(EventController.add('usr-1', race(), TODAY)).resolves.toBeDefined();
    expect(create).toHaveBeenCalledOnce();
  });

  it('counts against the active plan’s own days when there is one', async () => {
    findActive.mockResolvedValue({ endDate: '2026-09-21', startDate: '2026-09-08' });
    findInRange.mockResolvedValue([]);

    await EventController.add('usr-1', race(), TODAY);

    // Widened by the longest load, so an event just past the end still counts
    // when its days fall inside; the domain filter then decides which do.
    expect(findInRange).toHaveBeenCalledWith('usr-1', '2026-09-08', '2026-09-24');
  });

  it('counts against the fortnight from today when there is no plan', async () => {
    findInRange.mockResolvedValue([]);

    await EventController.add('usr-1', race(), TODAY);

    expect(findInRange).toHaveBeenCalledWith('usr-1', TODAY, '2026-09-26');
  });

  it('does not count an event whose load lies outside the window', async () => {
    // Three events on the days after the fortnight: none loads a day inside it.
    findInRange.mockResolvedValue([
      race({ id: 'a', daysBefore: 1, on: '2026-09-26' }),
      race({ id: 'b', daysBefore: 1, on: '2026-09-28' }),
      race({ id: 'c', daysBefore: 1, on: '2026-09-30' })
    ]);

    await expect(EventController.add('usr-1', race({ on: '2026-09-15' }), TODAY)).resolves.toBeDefined();
  });

  it('holds an event the week after next to that fortnight’s number, not this one’s', async () => {
    // The fortnight from today is empty; the one after it (24 Sep – 7 Oct) is full.
    findInRange.mockImplementation((_user, from) =>
      Promise.resolve(
        from === TODAY
          ? []
          : [
              race({ id: 'a', daysBefore: 1, on: '2026-09-26' }),
              race({ id: 'b', daysBefore: 1, on: '2026-09-28' }),
              race({ id: 'c', daysBefore: 1, on: '2026-09-30' })
            ]
      )
    );

    await expect(EventController.add('usr-1', race({ daysBefore: 1, on: '2026-10-05' }), TODAY)).rejects.toBeInstanceOf(QuotaExceededError);
    expect(findInRange).toHaveBeenLastCalledWith('usr-1', '2026-09-24', '2026-10-10');
  });

  it('still refuses an overlap before it ever counts', async () => {
    findUpcoming.mockResolvedValue([race({ on: '2026-09-20' })]);

    await expect(EventController.add('usr-1', race({ on: '2026-09-21' }), TODAY)).rejects.toBeInstanceOf(ConflictError);
    expect(findInRange).not.toHaveBeenCalled();
  });
});
