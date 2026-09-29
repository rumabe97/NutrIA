import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AdminNotificationController } from './AdminNotificationController';

const repository = vi.hoisted(() => ({ answeredReminders: vi.fn(), pushSubscriptionTotals: vi.fn(), remindersPerDay: vi.fn() }));

vi.mock('#repositories/Admin', () => ({
  AdminNotificationRepository: repository,
  JOB_STATUSES: [],
  PLAN_STATUSES: [],
  REMINDER_CHANNELS: ['email', 'push']
}));

const NOW = new Date('2026-09-29T10:00:00Z');

beforeEach(() => {
  vi.resetAllMocks();
  repository.answeredReminders.mockResolvedValue({ answered: 0, reminded: 0 });
  repository.pushSubscriptionTotals.mockResolvedValue({ people: 0, subscriptions: 0 });
  repository.remindersPerDay.mockResolvedValue([]);
});

describe('AdminNotificationController.notifications', () => {
  it('has both channels for every week, zeros included', async () => {
    const view = await AdminNotificationController.notifications(30, NOW);

    expect(view.remindersPerWeek.series.map(series => series.channel)).toEqual(['email', 'push']);
    expect(view.remindersPerWeek.weeks.length).toBeGreaterThanOrEqual(5);
    expect(view.remindersPerWeek.series.every(series => series.values.length === view.remindersPerWeek.weeks.length)).toBe(true);
    expect(view.remindersPerWeek.series.flatMap(series => series.values).every(value => value === 0)).toBe(true);
  });

  it('folds the days into the Monday of their Madrid week, per channel', async () => {
    repository.remindersPerDay.mockResolvedValue([
      { channel: 'email', day: '2026-09-28', n: 4 },
      { channel: 'email', day: '2026-09-29', n: 1 },
      { channel: 'push', day: '2026-09-29', n: 2 }
    ]);

    const { remindersPerWeek } = await AdminNotificationController.notifications(7, NOW);
    const last = remindersPerWeek.weeks.length - 1;

    expect(remindersPerWeek.weeks[last]).toBe('2026-09-28');
    expect(remindersPerWeek.series.find(series => series.channel === 'email')?.values[last]).toBe(5);
    expect(remindersPerWeek.series.find(series => series.channel === 'push')?.values[last]).toBe(2);
  });

  it('passes the push totals and the answered reminders through, asked over the period', async () => {
    repository.pushSubscriptionTotals.mockResolvedValue({ people: 3, subscriptions: 5 });
    repository.answeredReminders.mockResolvedValue({ answered: 2, reminded: 9 });

    const view = await AdminNotificationController.notifications(90, NOW);

    expect(view).toMatchObject({ checkIns: { answered: 2, reminded: 9 }, period: 90, push: { people: 3, subscriptions: 5 } });
    expect(repository.answeredReminders).toHaveBeenCalledWith(new Date(view.window.from), NOW);
  });
});
