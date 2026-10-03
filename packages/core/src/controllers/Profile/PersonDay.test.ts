import { beforeEach, describe, expect, it, vi } from 'vitest';

import { makeProfile } from '#test/fixtures';

import { personToday } from './PersonDay';

import type { Profile } from 'core/entities/Profile';

const findByUserId = vi.fn<(userId: string) => Promise<Profile | undefined>>();

vi.mock('#repositories/Profile', () => ({ ProfileRepository: { findByUserId: (userId: string) => findByUserId(userId) } }));

// 00:30 on the 3rd in Madrid; still the 2nd in UTC.
const AFTER_MADRID_MIDNIGHT = new Date('2026-10-02T22:30:00Z');

beforeEach(() => {
  findByUserId.mockReset();
});

describe('personToday', () => {
  it("is Madrid's date in the gap after Madrid's midnight, not UTC's", async () => {
    findByUserId.mockResolvedValue(makeProfile({ timezone: 'Europe/Madrid' }));

    await expect(personToday('usr-1', AFTER_MADRID_MIDNIGHT)).resolves.toBe('2026-10-03');
    expect(findByUserId).toHaveBeenCalledWith('usr-1');
  });

  it('reads the zone the profile keeps', async () => {
    findByUserId.mockResolvedValue(makeProfile({ timezone: 'America/New_York' }));

    await expect(personToday('usr-1', AFTER_MADRID_MIDNIGHT)).resolves.toBe('2026-10-02');
  });

  it("is Madrid's day for somebody with no profile yet", async () => {
    findByUserId.mockResolvedValue(undefined);

    await expect(personToday('usr-1', AFTER_MADRID_MIDNIGHT)).resolves.toBe('2026-10-03');
  });
});
