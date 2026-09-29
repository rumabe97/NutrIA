import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AnalyticsController } from './AnalyticsController';

const repository = vi.hoisted(() => ({ record: vi.fn(), recordOnceSince: vi.fn() }));

vi.mock('#repositories/Analytics', () => ({ AnalyticsRepository: repository }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AnalyticsController.recordUse', () => {
  it('asks for one `app_used` since the start of the Madrid day — not the UTC one', async () => {
    // 23:30 in Madrid on the 29th (summer time, UTC+2): still the 29th.
    await AnalyticsController.recordUse('usr-1', new Date('2026-09-29T21:30:00Z'));
    // 00:30 in Madrid on the 30th, while it is still the 29th in UTC.
    await AnalyticsController.recordUse('usr-1', new Date('2026-09-29T22:30:00Z'));

    expect(repository.recordOnceSince).toHaveBeenNthCalledWith(1, 'app_used', 'usr-1', new Date('2026-09-28T22:00:00Z'));
    expect(repository.recordOnceSince).toHaveBeenNthCalledWith(2, 'app_used', 'usr-1', new Date('2026-09-29T22:00:00Z'));
  });

  it('follows the winter offset too', async () => {
    await AnalyticsController.recordUse('usr-1', new Date('2026-12-01T10:00:00Z'));

    expect(repository.recordOnceSince).toHaveBeenCalledWith('app_used', 'usr-1', new Date('2026-11-30T23:00:00Z'));
  });
});
