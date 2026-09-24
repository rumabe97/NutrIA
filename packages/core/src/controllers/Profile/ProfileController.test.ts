import { beforeEach, describe, expect, it, vi } from 'vitest';

import { InputParseError, NotFoundError } from 'core/entities/Error';
import { makeGoal, makePreferences, makeProfile } from '#test/fixtures';

import { ProfileController } from './ProfileController';

import type { Goal, Preferences, Profile } from 'core/entities/Profile';
import type { TargetOverride, UpdateTargetOverride } from 'core/entities/Nutrition';
import type { ProfessionalSetter } from '#repositories/Profile';

/**
 * Who sets a target (project 004 Phase 4, PRD 004 criterion 7): the person's
 * own write records no setter, a professional's records theirs, and both are
 * judged by the same bounds and refused with the same error and sentences.
 */

const findByUserId = vi.fn<(userId: string) => Promise<Profile | undefined>>();
const findActiveGoal = vi.fn<(userId: string) => Promise<Goal | undefined>>();
const findPreferences = vi.fn<(userId: string) => Promise<Preferences | undefined>>();
const findTargetOverride = vi.fn<(userId: string) => Promise<TargetOverride | undefined>>();
const upsertTargetOverride = vi.fn<(userId: string, input: UpdateTargetOverride, setter: ProfessionalSetter | null) => Promise<TargetOverride>>();
const findLatestWeight = vi.fn<(userId: string) => Promise<number | null>>();

vi.mock('#repositories/Profile', () => ({
  ProfileRepository: {
    findActiveGoal: (userId: string) => findActiveGoal(userId),
    findByUserId: (userId: string) => findByUserId(userId),
    findPreferences: (userId: string) => findPreferences(userId),
    findTargetOverride: (userId: string) => findTargetOverride(userId),
    upsertTargetOverride: (...args: Parameters<typeof upsertTargetOverride>) => upsertTargetOverride(...args)
  }
}));
vi.mock('#repositories/Progress', () => ({ ProgressRepository: { findLatestWeight: (userId: string) => findLatestWeight(userId) } }));
vi.mock('#repositories/Safety', () => ({ SafetyRepository: {} }));
vi.mock('#repositories/Recipe', () => ({ FALLBACK_LOCALE: 'es-ES' }));

const CLIENT_ID = 'usr-client';
const PRO_ID = 'usr-pro';
const NOW = new Date('2026-09-24T10:00:00.000Z');
const SETTER: ProfessionalSetter = { professionalId: PRO_ID, record: async () => undefined };

function stored(fields: Partial<TargetOverride>): TargetOverride {
  return { carbsG: null, fatG: null, kcal: null, overriddenAt: NOW, proteinG: null, setBy: { kind: 'self' }, ...fields };
}

beforeEach(() => {
  for (const mock of [findByUserId, findActiveGoal, findPreferences, findTargetOverride, upsertTargetOverride, findLatestWeight]) {
    mock.mockReset();
  }

  findByUserId.mockResolvedValue(makeProfile());
  findActiveGoal.mockResolvedValue(makeGoal());
  findPreferences.mockResolvedValue(makePreferences());
  findLatestWeight.mockResolvedValue(null);
  findTargetOverride.mockResolvedValue(undefined);
});

describe('ProfileController.updateTargets', () => {
  it('records the person’s own write with no setter — a professional’s name, if there was one, is cleared', async () => {
    findTargetOverride.mockResolvedValue(stored({ kcal: 1800, setBy: { kind: 'professional', name: 'Dra. Pérez' } }));
    upsertTargetOverride.mockResolvedValue(stored({ kcal: 1750 }));

    const resolved = await ProfileController.updateTargets(CLIENT_ID, { kcal: 1750 });

    expect(upsertTargetOverride).toHaveBeenCalledExactlyOnceWith(CLIENT_ID, { kcal: 1750 }, null);
    expect(resolved.setBy).toEqual({ kind: 'self' });
  });

  it('records a professional’s write with the professional as the setter, and says so by name', async () => {
    upsertTargetOverride.mockResolvedValue(stored({ kcal: 1750, setBy: { kind: 'professional', name: 'Dra. Pérez' } }));

    const resolved = await ProfileController.updateTargets(CLIENT_ID, { kcal: 1750 }, SETTER);

    expect(upsertTargetOverride).toHaveBeenCalledExactlyOnceWith(CLIENT_ID, { kcal: 1750 }, SETTER);
    expect(resolved.overrideStatus).toBe('applied');
    expect(resolved.setBy).toEqual({ kind: 'professional', name: 'Dra. Pérez' });
    expect(JSON.stringify(resolved)).not.toContain(PRO_ID);
  });

  it('refuses an out-of-bounds professional target with the same error and sentences as the person’s own, writing nothing', async () => {
    const own = await ProfileController.updateTargets(CLIENT_ID, { kcal: 600 }).catch((error: unknown) => error);
    const professional = await ProfileController.updateTargets(CLIENT_ID, { kcal: 600 }, SETTER).catch((error: unknown) => error);

    expect(own).toBeInstanceOf(InputParseError);
    expect(professional).toBeInstanceOf(InputParseError);
    expect((professional as InputParseError).message).toBe((own as InputParseError).message);
    expect((professional as InputParseError).fieldErrors).toEqual((own as InputParseError).fieldErrors);
    expect((professional as InputParseError).fieldErrors.targets?.[0]).toMatch(/^El mínimo para tu perfil son \d+ kcal/);
    expect(upsertTargetOverride).not.toHaveBeenCalled();
  });

  it('is a 404 for a profile that cannot compute targets yet, whoever writes', async () => {
    findByUserId.mockResolvedValue(undefined);

    await expect(ProfileController.updateTargets(CLIENT_ID, { kcal: 1750 }, SETTER)).rejects.toBeInstanceOf(NotFoundError);
    expect(upsertTargetOverride).not.toHaveBeenCalled();
  });
});

describe('ProfileController.targets', () => {
  it('says whose the stored override is', async () => {
    findTargetOverride.mockResolvedValue(stored({ kcal: 1750, setBy: { kind: 'professional', name: 'Dra. Pérez' } }));

    expect((await ProfileController.targets(CLIENT_ID))?.setBy).toEqual({ kind: 'professional', name: 'Dra. Pérez' });
  });

  it('says nobody set anything when there is no override', async () => {
    expect((await ProfileController.targets(CLIENT_ID))?.setBy).toBeNull();
  });
});
