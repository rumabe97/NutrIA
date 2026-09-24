import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConflictError, NotFoundError } from 'core/entities/Error';

import { CheckInController, nudgedKcal } from './CheckInController';

import type { CheckInRow, PlanStats } from '#repositories/CheckIn';
import type { LinkWithProfessional } from '#repositories/Care';
import type { ResolvedTargets } from 'core/domain/Nutrition';

type PlanLite = { readonly id: string; readonly endDate: string };

const findById = vi.fn<(userId: string, planId: string) => Promise<PlanLite | undefined>>();
const create = vi.fn<(userId: string, input: unknown) => Promise<CheckInRow | undefined>>();
const findByPlan = vi.fn<(userId: string, planId: string) => Promise<CheckInRow | undefined>>();
const planStats = vi.fn<(userId: string, planId: string) => Promise<PlanStats>>();
const findLatest = vi.fn<(userId: string) => Promise<CheckInRow | undefined>>();
const upsertWeight = vi.fn<(userId: string, date: string, weightKg: number) => Promise<void>>();
const clientLink = vi.fn<(clientId: string) => Promise<LinkWithProfessional | null>>();
const findTargetSetterId = vi.fn<(userId: string) => Promise<string | null>>();
const getFullProfile = vi.fn<(userId: string) => Promise<{ targets: ResolvedTargets | null }>>();
const updateTargets = vi.fn<(userId: string, patch: unknown) => Promise<ResolvedTargets>>();

vi.mock('#repositories/Plan', () => ({ PlanRepository: { findById: (...args: Parameters<typeof findById>) => findById(...args) } }));
vi.mock('#repositories/CheckIn', () => ({
  CheckInRepository: {
    create: (...args: Parameters<typeof create>) => create(...args),
    findByPlan: (...args: Parameters<typeof findByPlan>) => findByPlan(...args),
    findLatest: (...args: Parameters<typeof findLatest>) => findLatest(...args),
    planStats: (...args: Parameters<typeof planStats>) => planStats(...args)
  }
}));
vi.mock('#repositories/Progress', () => ({
  ProgressRepository: { upsertWeight: (...args: Parameters<typeof upsertWeight>) => upsertWeight(...args) }
}));
vi.mock('#repositories/Care', () => ({ CareRepository: { clientLink: (clientId: string) => clientLink(clientId) } }));
vi.mock('#repositories/Profile', () => ({ ProfileRepository: { findTargetSetterId: (userId: string) => findTargetSetterId(userId) } }));
vi.mock('core/controllers/Profile', () => ({
  ProfileController: {
    getFullProfile: (...args: Parameters<typeof getFullProfile>) => getFullProfile(...args),
    updateTargets: (...args: Parameters<typeof updateTargets>) => updateTargets(...args)
  }
}));

const USER = 'usr-client';
const PLAN = { id: 'plan-1', endDate: '2026-09-24' };

function targets(overrides?: Partial<ResolvedTargets>): ResolvedTargets {
  return {
    bounds: { ceilingKcal: 2600, floorKcal: 1400, maintenanceKcal: 2200, proteinCeilingG: 200, proteinFloorG: 50 },
    computed: { carbsG: 200, fatG: 60, fiberG: 28, kcal: 2000, proteinG: 120 },
    derivation: {
      activityFactor: 1.2,
      basalMetabolicRateKcal: 1500,
      ceilingKcal: 2600,
      clampedBy: null,
      equation: 'mifflin-st-jeor',
      floorKcal: 1400,
      goal: 'maintenance',
      maintenanceKcal: 2200,
      paceKgPerWeek: 0.5,
      requestedKcal: 2000
    },
    effective: { carbsG: 200, fatG: 60, fiberG: 28, kcal: 2000, proteinG: 120 },
    overrideStatus: 'none',
    overrideViolations: [],
    setBy: null,
    ...overrides
  };
}

function checkInRow(overrides?: Partial<CheckInRow>): CheckInRow {
  return {
    id: 'checkin-1',
    comments: null,
    completedAt: '2026-09-24',
    difficultyRating: 2,
    hungerRating: 1,
    planId: PLAN.id,
    satisfactionRating: 4,
    weightKg: null,
    ...overrides
  };
}

beforeEach(() => {
  for (const mock of [
    findById,
    create,
    findByPlan,
    planStats,
    findLatest,
    upsertWeight,
    clientLink,
    findTargetSetterId,
    getFullProfile,
    updateTargets
  ]) {
    mock.mockReset();
  }

  findById.mockResolvedValue(PLAN);
  create.mockResolvedValue(checkInRow());
  clientLink.mockResolvedValue(null);
  findTargetSetterId.mockResolvedValue(null);
  getFullProfile.mockResolvedValue({ targets: targets() });
  updateTargets.mockResolvedValue(targets());
});

describe('nudgedKcal', () => {
  it('is null on "right"', () => {
    expect(nudgedKcal('right', targets())).toBeNull();
  });

  it('moves up 5% on "hungry", clamped to the ceiling', () => {
    expect(nudgedKcal('hungry', targets())).toBe(2100);
    expect(nudgedKcal('hungry', targets({ effective: { carbsG: 0, fatG: 0, fiberG: 0, kcal: 2550, proteinG: 0 } }))).toBe(2600);
  });

  it('moves down 5% on "too_much", clamped to the floor', () => {
    expect(nudgedKcal('too_much', targets())).toBe(1900);
    expect(nudgedKcal('too_much', targets({ effective: { carbsG: 0, fatG: 0, fiberG: 0, kcal: 1420, proteinG: 0 } }))).toBe(1400);
  });

  it('is null when the clamp leaves the number exactly where it is', () => {
    expect(
      nudgedKcal('hungry', targets({ bounds: { ...targets().bounds, ceilingKcal: 2000 }, effective: { ...targets().effective, kcal: 2000 } }))
    ).toBeNull();
  });
});

describe('CheckInController.submit', () => {
  it('is a 404 for a plan that is not this account’s, or under review', async () => {
    findById.mockResolvedValue(undefined);

    await expect(CheckInController.submit(USER, { difficulty: 'ok', hunger: 'right', planId: PLAN.id, satisfaction: 3 })).rejects.toBeInstanceOf(
      NotFoundError
    );
  });

  it('is a conflict when the fortnight already has its check-in, before anything else runs', async () => {
    create.mockResolvedValue(undefined);

    await expect(CheckInController.submit(USER, { difficulty: 'ok', hunger: 'right', planId: PLAN.id, satisfaction: 3 })).rejects.toBeInstanceOf(
      ConflictError
    );
    expect(upsertWeight).not.toHaveBeenCalled();
    expect(updateTargets).not.toHaveBeenCalled();
  });

  it('nudges kcal for an unlinked account, as today', async () => {
    const result = await CheckInController.submit(USER, { difficulty: 'ok', hunger: 'hungry', planId: PLAN.id, satisfaction: 3 });

    expect(updateTargets).toHaveBeenCalledWith(USER, { kcal: 2100 });
    expect(result.targets).toEqual({ fromKcal: 2000, toKcal: 2100 });
  });

  it('nudges kcal for a linked client whose targets are their own', async () => {
    clientLink.mockResolvedValue({ link: { professionalId: 'usr-pro', status: 'active' } as never, professionalName: 'Dra. Pérez' });
    findTargetSetterId.mockResolvedValue(null);

    const result = await CheckInController.submit(USER, { difficulty: 'ok', hunger: 'hungry', planId: PLAN.id, satisfaction: 3 });

    expect(updateTargets).toHaveBeenCalledWith(USER, { kcal: 2100 });
    expect(result.targets).not.toBeNull();
  });

  it('skips the nudge for a client with an active link whose override is a professional’s — the mark and the numbers stay', async () => {
    clientLink.mockResolvedValue({ link: { professionalId: 'usr-pro', status: 'active' } as never, professionalName: 'Dra. Pérez' });
    findTargetSetterId.mockResolvedValue('usr-pro');

    const result = await CheckInController.submit(USER, { difficulty: 'ok', hunger: 'hungry', planId: PLAN.id, satisfaction: 3 });

    expect(updateTargets).not.toHaveBeenCalled();
    expect(getFullProfile).not.toHaveBeenCalled();
    expect(result.targets).toBeNull();
    // The check-in is still recorded and the weight still logged.
    expect(create).toHaveBeenCalledOnce();
  });

  it('nudges as normal for a paused link — only "active" is supervised', async () => {
    clientLink.mockResolvedValue({ link: { professionalId: 'usr-pro', status: 'paused' } as never, professionalName: 'Dra. Pérez' });
    findTargetSetterId.mockResolvedValue('usr-pro');

    const result = await CheckInController.submit(USER, { difficulty: 'ok', hunger: 'hungry', planId: PLAN.id, satisfaction: 3 });

    expect(updateTargets).toHaveBeenCalledWith(USER, { kcal: 2100 });
    expect(result.targets).not.toBeNull();
  });

  it('logs weight and skips the nudge on "right", whatever the link says', async () => {
    clientLink.mockResolvedValue({ link: { professionalId: 'usr-pro', status: 'active' } as never, professionalName: 'Dra. Pérez' });
    findTargetSetterId.mockResolvedValue('usr-pro');

    const result = await CheckInController.submit(USER, { difficulty: 'ok', hunger: 'right', planId: PLAN.id, satisfaction: 3, weightKg: 70 });

    expect(upsertWeight).toHaveBeenCalledWith(USER, expect.any(String), 70);
    expect(updateTargets).not.toHaveBeenCalled();
    expect(result.weightLogged).toBe(true);
    expect(result.targets).toBeNull();
  });
});
