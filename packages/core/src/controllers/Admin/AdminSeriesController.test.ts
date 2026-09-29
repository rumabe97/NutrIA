import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AdminSeriesController } from './AdminSeriesController';

import type { Funnel, AdminSeriesRepository as Series } from '#repositories/Admin';

const series = vi.hoisted(() => ({
  accountTotals: vi.fn<(typeof Series)['accountTotals']>(),
  activePeoplePerDay: vi.fn<(typeof Series)['activePeoplePerDay']>(),
  activePeopleTotals: vi.fn<(typeof Series)['activePeopleTotals']>(),
  eventsPerDay: vi.fn<(typeof Series)['eventsPerDay']>(),
  generationsPerDay: vi.fn<(typeof Series)['generationsPerDay']>(),
  generationTotals: vi.fn<(typeof Series)['generationTotals']>(),
  messagesPerDay: vi.fn<(typeof Series)['messagesPerDay']>(),
  pictureSpendTotals: vi.fn<(typeof Series)['pictureSpendTotals']>(),
  plansByState: vi.fn<(typeof Series)['plansByState']>(),
  plansCreatedPerDay: vi.fn<(typeof Series)['plansCreatedPerDay']>(),
  planTotals: vi.fn<(typeof Series)['planTotals']>(),
  signUpsPerDay: vi.fn<(typeof Series)['signUpsPerDay']>(),
  unreadMessages: vi.fn<(typeof Series)['unreadMessages']>()
}));
const funnel = vi.hoisted(() => vi.fn<() => Promise<Funnel>>());
const ai = vi.hoisted(() => ({ callsPerDay: vi.fn() }));

vi.mock('#repositories/Admin', () => ({
  AdminAiRepository: ai,
  AdminRepository: { funnel },
  AdminSeriesRepository: series,
  JOB_STATUSES: ['queued', 'running', 'succeeded', 'failed'],
  PLAN_STATUSES: ['draft', 'generating', 'active', 'completed', 'archived', 'failed', 'pending_review']
}));

/** Sunday 28 September 2026, noon in Madrid. */
const NOW = new Date('2026-09-28T10:00:00Z');
const WEEK = ['2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27', '2026-09-28'];

const FUNNEL: Funnel = { activated: 5, checkedIn: 1, confirmed: 6, lived: 2, onboarded: 4, planned: 3, returned: 1, signedUp: 7 };

beforeEach(() => {
  vi.clearAllMocks();
  ai.callsPerDay.mockResolvedValue([
    // The period before, then two models on one day of this one: the tile sums them.
    { costUsd: 0.4, day: '2026-09-20' },
    { costUsd: 0.1, day: '2026-09-23' },
    { costUsd: 0.2, day: '2026-09-23' },
    { costUsd: 0.05, day: '2026-09-28' }
  ]);
  series.accountTotals.mockResolvedValue({ created: { current: 3, previous: 1 }, total: 40, waiting: 2 });
  series.activePeopleTotals.mockResolvedValue({ current: 9, previous: 12 });
  series.planTotals.mockResolvedValue({ current: 4, previous: 0 });
  series.generationTotals.mockResolvedValue({ current: { failed: 1, succeeded: 3 }, previous: { failed: 0, succeeded: 0 }, recentFailures: 1 });
  series.pictureSpendTotals.mockResolvedValue({ current: 0.5, month: 2.25, previous: 0.75 });
  series.unreadMessages.mockResolvedValue(6);
  series.signUpsPerDay.mockResolvedValue([
    { day: '2026-09-22', n: 1 },
    { day: '2026-09-28', n: 2 }
  ]);
  series.generationsPerDay.mockResolvedValue([
    { day: '2026-09-23', key: 'succeeded', n: 3 },
    { day: '2026-09-23', key: 'failed', n: 1 }
  ]);
  series.activePeoplePerDay.mockResolvedValue([{ day: '2026-09-27', n: 9 }]);
  series.messagesPerDay.mockResolvedValue([
    { day: '2026-09-23', n: 2 },
    { day: '2026-09-27', n: 1 },
    { day: '2026-09-28', n: 4 }
  ]);
  series.plansCreatedPerDay.mockResolvedValue([{ day: '2026-09-23', n: 3 }]);
  series.eventsPerDay.mockResolvedValue([{ day: '2026-09-25', key: 'swap_requested', n: 2 }]);
  series.plansByState.mockResolvedValue([
    { n: 2, status: 'active' },
    { n: 5, status: 'completed' }
  ]);
  funnel.mockResolvedValue(FUNNEL);
});

describe('AdminSeriesController.summary', () => {
  it('asks every read for the same window, and the failures for the last 24 hours', async () => {
    await AdminSeriesController.summary(7, 10, NOW);

    const window = { from: new Date('2026-09-21T22:00:00Z'), previousFrom: new Date('2026-09-14T22:00:00Z'), to: NOW };

    expect(series.accountTotals).toHaveBeenCalledWith(window);
    expect(series.generationTotals).toHaveBeenCalledWith(window, new Date('2026-09-27T10:00:00Z'));
    expect(series.pictureSpendTotals).toHaveBeenCalledWith(window, new Date('2026-09-01T00:00:00Z'));
    expect(series.signUpsPerDay).toHaveBeenCalledWith(window.from, NOW);
  });

  it('presents the tiles against the previous period, with their sparklines on the period’s days', async () => {
    const view = await AdminSeriesController.summary(7, 10, NOW);

    expect(view.period).toBe(7);
    expect(view.window).toEqual({ from: '2026-09-21T22:00:00.000Z', previousFrom: '2026-09-14T22:00:00.000Z', to: '2026-09-28T10:00:00.000Z' });
    expect(view.tiles.totalAccounts).toBe(40);
    expect(view.tiles.waitingAccounts).toBe(2);
    expect(view.tiles.unreadMessages).toBe(6);
    expect(view.tiles.newAccounts).toEqual({ current: 3, previous: 1, sparkline: { days: WEEK, values: [1, 0, 0, 0, 0, 0, 2] } });
    expect(view.tiles.activePeople).toEqual({ current: 9, previous: 12, sparkline: { days: WEEK, values: [0, 0, 0, 0, 0, 9, 0] } });
    expect(view.tiles.plansGenerated).toEqual({ current: 4, previous: 0, sparkline: { days: WEEK, values: [0, 3, 0, 0, 0, 0, 0] } });
    expect(view.tiles.pictures).toEqual({
      capUsd: 10,
      monthSpentUsd: 2.25,
      monthStart: '2026-09-01T00:00:00.000Z',
      spentUsd: { current: 0.5, previous: 0.75 }
    });
  });

  it('gives a success rate over finished generations, and none for a period where nothing finished', async () => {
    const view = await AdminSeriesController.summary(7, 10, NOW);

    expect(view.tiles.successRate).toEqual({ current: 0.75, previous: null });
  });

  it('charts sign-ups, and generations with every status present, zeros included', async () => {
    const view = await AdminSeriesController.summary(7, 10, NOW);

    expect(view.charts.signUps).toBe(view.tiles.newAccounts.sparkline);
    expect(view.charts.generations).toEqual({
      days: WEEK,
      series: [
        { key: 'queued', values: [0, 0, 0, 0, 0, 0, 0] },
        { key: 'running', values: [0, 0, 0, 0, 0, 0, 0] },
        { key: 'succeeded', values: [0, 3, 0, 0, 0, 0, 0] },
        { key: 'failed', values: [0, 1, 0, 0, 0, 0, 0] }
      ]
    });
  });

  it('counts what needs the owner now', async () => {
    const view = await AdminSeriesController.summary(30, 10, NOW);

    expect(view.needsYou).toEqual({ failedGenerations: 1, unreadMessages: 6, waitingAccounts: 2 });
    expect(view.charts.signUps.days).toHaveLength(30);
  });

  it('carries counts and nothing else: no field that could hold a person or their food', async () => {
    const text = JSON.stringify(await AdminSeriesController.summary(90, 10, NOW));

    for (const word of ['email', 'name', 'meal', 'recipe', 'allerg', 'profile', 'userId']) {
      expect(text.toLowerCase()).not.toContain(word.toLowerCase());
    }
  });
});

describe('AdminSeriesController.product', () => {
  it('keeps the funnel as it stands and charts the period’s people and events, ai_call excepted', async () => {
    const view = await AdminSeriesController.product(7, NOW);

    expect(view.funnel).toEqual(FUNNEL);
    expect(view.activePeople).toEqual({ days: WEEK, values: [0, 0, 0, 0, 0, 9, 0] });
    expect(series.eventsPerDay).toHaveBeenCalledWith(['session_started', 'swap_requested'], new Date('2026-09-21T22:00:00Z'), NOW);
    expect(view.events).toEqual({
      days: WEEK,
      series: [
        { key: 'session_started', values: [0, 0, 0, 0, 0, 0, 0] },
        { key: 'swap_requested', values: [0, 0, 0, 2, 0, 0, 0] }
      ]
    });
    expect(view.window.from).toBe('2026-09-21T22:00:00.000Z');
  });
});

describe('AdminSeriesController.plans', () => {
  it('gives every state in the schema’s order, zeros included, and plans made per day', async () => {
    const view = await AdminSeriesController.plans(7, NOW);

    expect(view.byState).toEqual([
      { n: 0, status: 'draft' },
      { n: 0, status: 'generating' },
      { n: 2, status: 'active' },
      { n: 5, status: 'completed' },
      { n: 0, status: 'archived' },
      { n: 0, status: 'failed' },
      { n: 0, status: 'pending_review' }
    ]);
    expect(view.created).toEqual({ days: WEEK, values: [0, 3, 0, 0, 0, 0, 0] });
    expect(view.period).toBe(7);
  });
});

describe('AdminSeriesController.people', () => {
  it('folds sign-ups and messages into Madrid ISO weeks, named by their Monday', async () => {
    const view = await AdminSeriesController.people(7, NOW);

    expect(series.signUpsPerDay).toHaveBeenCalledWith(new Date('2026-09-21T22:00:00Z'), NOW);
    expect(series.messagesPerDay).toHaveBeenCalledWith(new Date('2026-09-21T22:00:00Z'), NOW);
    expect(view.signUps).toEqual({ values: [1, 2], weeks: ['2026-09-21', '2026-09-28'] });
    expect(view.messages).toEqual({ values: [3, 4], weeks: ['2026-09-21', '2026-09-28'] });
    expect(view.period).toBe(7);
    expect(view.window.from).toBe('2026-09-21T22:00:00.000Z');
  });

  it('has a zero for every quiet week of the period', async () => {
    series.signUpsPerDay.mockResolvedValue([]);

    const view = await AdminSeriesController.people(30, NOW);

    expect(view.signUps).toEqual({
      values: [0, 0, 0, 0, 0, 0],
      weeks: ['2026-08-24', '2026-08-31', '2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28']
    });
    expect(view.messages.values).toEqual([0, 0, 0, 0, 3, 4]);
  });
});

describe('AdminSeriesController.summary — the text models’ spend', () => {
  it('sums the period against the one before, and lays the period’s days as the sparkline', async () => {
    const summary = await AdminSeriesController.summary(7, 10, NOW);

    expect(ai.callsPerDay).toHaveBeenCalledWith(new Date('2026-09-14T22:00:00Z'), NOW);
    expect(summary.tiles.textAi).toEqual({
      sparkline: { days: WEEK, values: [0, 0.3, 0, 0, 0, 0, 0.05] },
      spentUsd: { current: 0.35, previous: 0.4 }
    });
  });
});
