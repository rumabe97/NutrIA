import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CARE_CONSENT_VERSION } from 'core/entities/Care';
import { DatabaseOperationError, InputParseError, NotFoundError } from 'core/entities/Error';

import { CareController } from './CareController';

import type { ActiveLink, Roster, RosterLink } from '#repositories/Care';
import type { CareAccessAction, CareAccessEntry, CareAccessKind, CareLink } from 'core/entities/Care';
import type { JobView, PlanView } from 'core/controllers/Plan';
import type { ProgressSummaryView } from 'core/controllers/Progress';
import type { RecordAccess } from '#repositories/Care';
import type { ResolvedTargets } from 'core/domain/Nutrition';
import type { SharedHealthView } from 'core/controllers/Health';
import type { UpdateTargetOverride } from 'core/entities/Nutrition';
import type { ProfessionalSetter } from '#repositories/Profile';

/**
 * The delegated path (`0059`, project 004 Phase 3): `withClient`, the one
 * function that turns a professional's session into a client's id, and what is
 * built on it — the client's page, the professional's list, the client's trail.
 *
 * The claims: a link that is not this professional's and active is a 404 with
 * nothing written; every read writes its row before the data is read; the
 * page writes exactly one `overview` row, plus one `health` row only under
 * the health line, and has no `health` key otherwise; a `health` read without
 * the health line is refused; the list is refused to anybody who is not a
 * professional and carries no client id (its `list` rows are the repository's,
 * written in `roster`'s own snapshot).
 */

type LogEntry = {
  readonly action: CareAccessAction;
  readonly kind: CareAccessKind;
  readonly professionalId: string;
  readonly professionalName: string;
};

const activeLink = vi.fn<(professionalId: string, linkId: string) => Promise<ActiveLink | null>>();
const logAccess = vi.fn<(clientId: string, entry: LogEntry, tx?: unknown) => Promise<void>>();
const roster = vi.fn<(professionalId: string, now: Date) => Promise<Roster>>();
const accessLog = vi.fn<(clientId: string, limit: number, beforeId: string | null) => Promise<readonly CareAccessEntry[]>>();
const findProfessional = vi.fn<(userId: string) => Promise<object | null>>();
const isEnabled = vi.fn<(key: string, fallback: boolean) => Promise<boolean>>();
const getActivePlan = vi.fn<(userId: string, locale: string | null) => Promise<null>>();
const listPlans = vi.fn<(userId: string) => Promise<readonly []>>();
const summary = vi.fn<(userId: string) => Promise<ProgressSummaryView>>();
const targets = vi.fn<(userId: string) => Promise<ResolvedTargets | null>>();
const updateTargets = vi.fn<(userId: string, patch: UpdateTargetOverride, setter?: ProfessionalSetter | null) => Promise<ResolvedTargets>>();
const shared = vi.fn<(userId: string) => Promise<SharedHealthView>>();
const setReview = vi.fn<(professionalId: string, linkId: string, value: boolean, record: RecordAccess) => Promise<CareLink | null>>();
const getPendingPlan = vi.fn<(userId: string, locale: string | null) => Promise<PlanView | null>>();
const getJob = vi.fn<(userId: string, jobId: string, reader: string) => Promise<JobView>>();
const publish = vi.fn<(userId: string, record: RecordAccess, locale: string | null) => Promise<PlanView>>();
const professionalMayGenerate = vi.fn<(userId: string) => Promise<boolean>>();

vi.mock('#repositories/Care', () => ({
  CareRepository: {
    accessLog: (...args: Parameters<typeof accessLog>) => accessLog(...args),
    activeLink: (...args: Parameters<typeof activeLink>) => activeLink(...args),
    logAccess: (...args: Parameters<typeof logAccess>) => logAccess(...args),
    roster: (...args: Parameters<typeof roster>) => roster(...args),
    setReview: (...args: Parameters<typeof setReview>) => setReview(...args)
  }
}));
vi.mock('#repositories/Professional', () => ({ ProfessionalRepository: { find: (userId: string) => findProfessional(userId) } }));
vi.mock('#repositories/Settings', () => ({ SettingsRepository: { isEnabled: (key: string, fallback: boolean) => isEnabled(key, fallback) } }));
vi.mock('core/controllers/Plan', () => ({
  PlanController: {
    getActivePlan: (...args: Parameters<typeof getActivePlan>) => getActivePlan(...args),
    getJob: (...args: Parameters<typeof getJob>) => getJob(...args),
    getPendingPlan: (...args: Parameters<typeof getPendingPlan>) => getPendingPlan(...args),
    listPlans: (userId: string) => listPlans(userId),
    professionalMayGenerate: (userId: string) => professionalMayGenerate(userId),
    publish: (...args: Parameters<typeof publish>) => publish(...args)
  }
}));
vi.mock('core/controllers/Progress', () => ({ ProgressController: { summary: (userId: string) => summary(userId) } }));
vi.mock('core/controllers/Profile', () => ({
  ProfileController: {
    targets: (userId: string) => targets(userId),
    updateTargets: (...args: Parameters<typeof updateTargets>) => updateTargets(...args)
  }
}));
vi.mock('core/controllers/Health', () => ({ HealthController: { shared: (userId: string) => shared(userId) } }));

const NOW = new Date('2026-09-24T10:00:00.000Z');
const LINK_ID = '0b8e7f4a-3c2d-4e1f-9a8b-7c6d5e4f3a2b';
const PRO = { id: 'usr-pro' };
const CLIENT_ID = 'usr-client';
const HEALTH: SharedHealthView = {
  conditions: [],
  medications: [{ id: '5e4f3a2b-0b8e-4f4a-8c2d-7c6d0b8e7f4a', name: 'Metformina' }],
  supplements: []
};
const PROGRESS: ProgressSummaryView = {
  fortnights: [],
  overall: { adherence: null, eaten: 0, marked: 0 },
  weight: {
    changeKg: null,
    entries: [],
    fortnightChangeKg: null,
    goalType: null,
    latestKg: null,
    startingWeightKg: null,
    targetWeightKg: null,
    toTargetKg: null
  }
};

function makeLink(overrides?: Partial<CareLink>): CareLink {
  return {
    id: LINK_ID,
    clientId: CLIENT_ID,
    consentedAt: NOW,
    consentVersion: CARE_CONSENT_VERSION,
    createdAt: NOW,
    endedAt: null,
    endedBy: null,
    professionalId: PRO.id,
    reviewBeforePublish: true,
    sharesHealth: false,
    status: 'active',
    updatedAt: NOW,
    ...overrides
  };
}

function access(overrides?: Partial<CareLink>): ActiveLink {
  return { clientName: 'Lucía', link: makeLink(overrides), professionalName: 'Dra. Pérez' };
}

function rosterLink(overrides?: Partial<RosterLink>): RosterLink {
  return {
    clientName: 'Lucía',
    latestPlan: null,
    link: { id: LINK_ID, consentedAt: NOW, reviewBeforePublish: true, sharesHealth: false, status: 'active' },
    onboarded: true,
    planActive: false,
    planPendingReview: false,
    ...overrides
  };
}

beforeEach(() => {
  for (const mock of [
    activeLink,
    logAccess,
    roster,
    accessLog,
    findProfessional,
    isEnabled,
    getActivePlan,
    listPlans,
    summary,
    targets,
    updateTargets,
    shared,
    setReview,
    getPendingPlan,
    getJob,
    publish,
    professionalMayGenerate
  ]) {
    mock.mockReset();
  }

  isEnabled.mockResolvedValue(true);
  findProfessional.mockResolvedValue({ practiceOpen: true, userId: PRO.id });
  logAccess.mockResolvedValue(undefined);
  getActivePlan.mockResolvedValue(null);
  listPlans.mockResolvedValue([]);
  summary.mockResolvedValue(PROGRESS);
  targets.mockResolvedValue(null);
  shared.mockResolvedValue(HEALTH);
  professionalMayGenerate.mockResolvedValue(true);
});

describe('CareController.withClient', () => {
  it('resolves the link against the session’s professional, writes the row, then hands over the client’s id — in that order', async () => {
    activeLink.mockResolvedValue(access());
    const order: string[] = [];

    logAccess.mockImplementation(async () => {
      order.push('log');
    });

    const result = await CareController.withClient(PRO.id, LINK_ID, 'targets', 'read', async (clientId, resolved) => {
      order.push('read');

      return { clientId, name: resolved.clientName };
    });

    expect(activeLink).toHaveBeenCalledWith(PRO.id, LINK_ID);
    expect(logAccess).toHaveBeenCalledExactlyOnceWith(CLIENT_ID, {
      action: 'read',
      kind: 'targets',
      professionalId: PRO.id,
      professionalName: 'Dra. Pérez'
    });
    expect(order).toEqual(['log', 'read']);
    expect(result).toEqual({ clientId: CLIENT_ID, name: 'Lucía' });
  });

  it('is a 404, with nothing written and nothing read, for a link that is not this professional’s and active', async () => {
    activeLink.mockResolvedValue(null);
    const fn = vi.fn(async () => 'read');

    await expect(CareController.withClient(PRO.id, LINK_ID, 'overview', 'read', fn)).rejects.toBeInstanceOf(NotFoundError);
    expect(logAccess).not.toHaveBeenCalled();
    expect(fn).not.toHaveBeenCalled();
  });

  it('is the same 404, without asking the database, for something that is not a link id', async () => {
    const fn = vi.fn(async () => 'read');

    for (const linkId of ['', 'usr-client', '1', `${LINK_ID}x`]) {
      await expect(CareController.withClient(PRO.id, linkId, 'overview', 'read', fn)).rejects.toBeInstanceOf(NotFoundError);
    }

    expect(activeLink).not.toHaveBeenCalled();
    expect(fn).not.toHaveBeenCalled();
  });

  it('is a 404 while the switch is off, before the link is looked up', async () => {
    isEnabled.mockResolvedValue(false);

    await expect(CareController.withClient(PRO.id, LINK_ID, 'overview', 'read', async () => 'read')).rejects.toBeInstanceOf(NotFoundError);
    expect(activeLink).not.toHaveBeenCalled();
    expect(logAccess).not.toHaveBeenCalled();
  });

  it('refuses a health read on a link without the health line, with nothing written and nothing read', async () => {
    activeLink.mockResolvedValue(access({ sharesHealth: false }));
    const fn = vi.fn(async () => 'read');

    await expect(CareController.withClient(PRO.id, LINK_ID, 'health', 'read', fn)).rejects.toBeInstanceOf(NotFoundError);
    expect(logAccess).not.toHaveBeenCalled();
    expect(fn).not.toHaveBeenCalled();
  });

  it('hands the callback the link without either account’s id', async () => {
    activeLink.mockResolvedValue(access());

    const link = await CareController.withClient(PRO.id, LINK_ID, 'overview', 'read', async (_clientId, resolved) => resolved.link);

    expect(link).not.toHaveProperty('clientId');
    expect(link).not.toHaveProperty('professionalId');
  });

  it('reads nothing when the row cannot be written — no read without its row', async () => {
    activeLink.mockResolvedValue(access());
    logAccess.mockRejectedValue(new DatabaseOperationError());
    const fn = vi.fn(async () => 'read');

    await expect(CareController.withClient(PRO.id, LINK_ID, 'overview', 'read', fn)).rejects.toBeInstanceOf(DatabaseOperationError);
    expect(fn).not.toHaveBeenCalled();
  });
});

describe('CareController.overview', () => {
  it('reads the client’s page through the link — one overview row, and no health key without the health line', async () => {
    activeLink.mockResolvedValue(access());

    const page = await CareController.overview(PRO, LINK_ID, 'en-GB');

    expect(logAccess).toHaveBeenCalledExactlyOnceWith(CLIENT_ID, expect.objectContaining({ action: 'read', kind: 'overview' }));
    expect(getActivePlan).toHaveBeenCalledWith(CLIENT_ID, 'en-GB');
    expect(listPlans).toHaveBeenCalledWith(CLIENT_ID);
    expect(summary).toHaveBeenCalledWith(CLIENT_ID);
    expect(targets).toHaveBeenCalledWith(CLIENT_ID);
    expect(shared).not.toHaveBeenCalled();
    expect(Object.keys(page).sort()).toEqual(['client', 'plan', 'plans', 'progress', 'targets']);
    expect(page.client).toEqual({
      linkId: LINK_ID,
      name: 'Lucía',
      reviewBeforePublish: true,
      sharesHealth: false,
      since: NOW.toISOString(),
      status: 'active'
    });
    expect(JSON.stringify(page)).not.toContain(CLIENT_ID);
  });

  it('adds health under the health line, read as its own row — exactly two rows, overview then health', async () => {
    activeLink.mockResolvedValue(access({ sharesHealth: true }));

    const page = await CareController.overview(PRO, LINK_ID);

    expect(logAccess.mock.calls.map(([clientId, entry]) => [clientId, entry.kind, entry.action])).toEqual([
      [CLIENT_ID, 'overview', 'read'],
      [CLIENT_ID, 'health', 'read']
    ]);
    expect(shared).toHaveBeenCalledExactlyOnceWith(CLIENT_ID);
    expect(page.health).toEqual(HEALTH);
  });

  it('leaves health out, with no health row, when the link ends between the two reads', async () => {
    activeLink.mockResolvedValueOnce(access({ sharesHealth: true })).mockResolvedValueOnce(null);

    const page = await CareController.overview(PRO, LINK_ID);

    expect(logAccess).toHaveBeenCalledExactlyOnceWith(CLIENT_ID, expect.objectContaining({ kind: 'overview' }));
    expect(shared).not.toHaveBeenCalled();
    expect('health' in page).toBe(false);
  });

  it('is a 404 with no row and no read for another professional’s link', async () => {
    activeLink.mockResolvedValue(null);

    await expect(CareController.overview({ id: 'usr-other-pro' }, LINK_ID)).rejects.toBeInstanceOf(NotFoundError);
    expect(activeLink).toHaveBeenCalledWith('usr-other-pro', LINK_ID);
    expect(logAccess).not.toHaveBeenCalled();
    expect(getActivePlan).not.toHaveBeenCalled();
    expect(summary).not.toHaveBeenCalled();
  });

  it('carries the kcal the nudge would set beside each check-in that answered other than "right" (PRD 004, criterion 10)', async () => {
    activeLink.mockResolvedValue(access());
    const resolved = {
      bounds: { ceilingKcal: 2600, floorKcal: 1400, maintenanceKcal: 2200, proteinCeilingG: 200, proteinFloorG: 50 },
      effective: { carbsG: 200, fatG: 60, fiberG: 28, kcal: 2000, proteinG: 120 }
    } as ResolvedTargets;

    targets.mockResolvedValue(resolved);
    summary.mockResolvedValue({
      ...PROGRESS,
      fortnights: [
        {
          adherence: 90,
          checkIn: { difficulty: 'ok', hunger: 'hungry', satisfaction: 4, weightKg: 70 },
          endDate: '2026-09-24',
          meals: { eaten: 12, skipped: 2, soFar: 14 },
          planId: 'plan-1',
          replaced: false,
          startDate: '2026-09-10',
          status: 'active',
          version: 1
        },
        {
          adherence: 100,
          checkIn: { difficulty: 'ok', hunger: 'right', satisfaction: 4, weightKg: 70 },
          endDate: '2026-09-10',
          meals: { eaten: 14, skipped: 0, soFar: 14 },
          planId: 'plan-0',
          replaced: true,
          startDate: '2026-08-27',
          status: 'completed',
          version: 0
        },
        {
          adherence: null,
          checkIn: null,
          endDate: '2026-08-27',
          meals: { eaten: 0, skipped: 0, soFar: 0 },
          planId: 'plan-x',
          replaced: false,
          startDate: '2026-08-13',
          status: 'completed',
          version: -1
        }
      ]
    });

    const page = await CareController.overview(PRO, LINK_ID);

    expect(page.progress.fortnights[0]?.checkIn?.suggestedKcal).toBe(2100);
    expect(page.progress.fortnights[1]?.checkIn?.suggestedKcal).toBeNull();
    expect(page.progress.fortnights[2]?.checkIn).toBeNull();
  });

  it('carries no suggestion when the profile cannot resolve targets', async () => {
    activeLink.mockResolvedValue(access());
    targets.mockResolvedValue(null);
    summary.mockResolvedValue({
      ...PROGRESS,
      fortnights: [
        {
          adherence: 90,
          checkIn: { difficulty: 'ok', hunger: 'hungry', satisfaction: 4, weightKg: 70 },
          endDate: '2026-09-24',
          meals: { eaten: 12, skipped: 2, soFar: 14 },
          planId: 'plan-1',
          replaced: false,
          startDate: '2026-09-10',
          status: 'active',
          version: 1
        }
      ]
    });

    const page = await CareController.overview(PRO, LINK_ID);

    expect(page.progress.fortnights[0]?.checkIn?.suggestedKcal).toBeNull();
  });
});

describe('CareController.setTargets', () => {
  it('writes through the link — the client’s own update with the professional as the setter, and the row inside the write', async () => {
    activeLink.mockResolvedValue(access());
    const order: string[] = [];
    const tx = { transaction: 'the write’s' };
    const resolved = { setBy: { kind: 'professional', name: 'Dra. Pérez' } } as unknown as ResolvedTargets;

    logAccess.mockImplementation(async () => {
      order.push('log');
    });
    updateTargets.mockImplementation(async (_clientId, _patch, setter) => {
      order.push('write');
      await setter?.record(tx as never);

      return resolved;
    });

    await expect(CareController.setTargets(PRO, LINK_ID, { kcal: 1750 })).resolves.toBe(resolved);
    expect(activeLink).toHaveBeenCalledWith(PRO.id, LINK_ID);
    expect(logAccess).toHaveBeenCalledExactlyOnceWith(
      CLIENT_ID,
      { action: 'write', kind: 'targets', professionalId: PRO.id, professionalName: 'Dra. Pérez' },
      tx
    );
    expect(updateTargets).toHaveBeenCalledOnce();
    expect(updateTargets.mock.calls[0]?.slice(0, 2)).toEqual([CLIENT_ID, { kcal: 1750 }]);
    expect(updateTargets.mock.calls[0]?.[2]?.professionalId).toBe(PRO.id);
    expect(order).toEqual(['write', 'log']);
  });

  it('writes no row for a refused target — the row goes in with the change or not at all', async () => {
    activeLink.mockResolvedValue(access());
    updateTargets.mockRejectedValue(new InputParseError('Targets out of bounds', { targets: ['El mínimo para tu perfil son 1300 kcal.'] }));

    await expect(CareController.setTargets(PRO, LINK_ID, { kcal: 600 })).rejects.toBeInstanceOf(InputParseError);
    expect(logAccess).not.toHaveBeenCalled();
  });

  it('fails a write that returns without having recorded its row', async () => {
    activeLink.mockResolvedValue(access());

    await expect(CareController.withClient(PRO.id, LINK_ID, 'targets', 'write', async () => 'written')).rejects.toBeInstanceOf(
      DatabaseOperationError
    );
  });

  it('passes the client’s refusal through unchanged — the same error, not a second rule', async () => {
    activeLink.mockResolvedValue(access());
    const refusal = new InputParseError('Targets out of bounds', { targets: ['El mínimo para tu perfil son 1300 kcal.'] });

    updateTargets.mockRejectedValue(refusal);

    await expect(CareController.setTargets(PRO, LINK_ID, { kcal: 600 })).rejects.toBe(refusal);
  });

  it('is a 404 with no row and nothing written for a link that is not this professional’s and active', async () => {
    activeLink.mockResolvedValue(null);

    await expect(CareController.setTargets({ id: 'usr-other-pro' }, LINK_ID, { kcal: 1750 })).rejects.toBeInstanceOf(NotFoundError);
    expect(activeLink).toHaveBeenCalledWith('usr-other-pro', LINK_ID);
    expect(logAccess).not.toHaveBeenCalled();
    expect(updateTargets).not.toHaveBeenCalled();
  });

  it('is the same 404, without asking the database, for something that is not a link id', async () => {
    await expect(CareController.setTargets(PRO, CLIENT_ID, { kcal: 1750 })).rejects.toBeInstanceOf(NotFoundError);
    expect(activeLink).not.toHaveBeenCalled();
    expect(updateTargets).not.toHaveBeenCalled();
  });
});

describe('CareController.clients', () => {
  it('says where each client is, from stored state, in the order a professional acts on it', async () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f'].map(letter => `${letter}b8e7f4a-3c2d-4e1f-9a8b-7c6d5e4f3a2b`);
    const link = (index: number, status: 'active' | 'paused' = 'active') => ({
      id: ids[index] ?? '',
      consentedAt: NOW,
      reviewBeforePublish: true,
      sharesHealth: false,
      status
    });

    roster.mockResolvedValue({
      invitations: [{ email: 'nueva@example.com', expiresAt: NOW }],
      links: [
        rosterLink({ link: link(0), onboarded: false }),
        rosterLink({ latestPlan: { answered: false, endDate: '2026-09-24' }, link: link(1), planActive: true }),
        rosterLink({ latestPlan: { answered: false, endDate: '2026-09-25' }, link: link(2), planActive: true }),
        rosterLink({ latestPlan: { answered: true, endDate: '2026-09-20' }, link: link(3) }),
        rosterLink({ latestPlan: { answered: false, endDate: '2026-09-20' }, link: link(4), planActive: true, planPendingReview: true }),
        rosterLink({ link: link(5, 'paused'), onboarded: false })
      ]
    });

    const view = await CareController.clients(PRO, NOW);

    expect(roster).toHaveBeenCalledWith(PRO.id, NOW);
    expect(view.clients.map(client => [client.status, client.stage])).toEqual([
      ['active', 'onboarding'],
      ['active', 'check_in_due'],
      ['active', 'plan_under_way'],
      ['active', 'awaiting_plan'],
      ['active', 'plan_awaiting_review'],
      ['paused', null]
    ]);
    expect(view.invitations).toEqual([{ email: 'nueva@example.com', expiresAt: NOW.toISOString() }]);
  });

  it('names no client id, and writes no row of its own beyond what the repository writes in its snapshot', async () => {
    roster.mockResolvedValue({ invitations: [], links: [rosterLink()] });

    const view = await CareController.clients(PRO, NOW);

    expect(logAccess).not.toHaveBeenCalled();
    expect(Object.keys(view.clients[0] ?? {}).sort()).toEqual(['linkId', 'name', 'reviewBeforePublish', 'sharesHealth', 'since', 'stage', 'status']);
  });

  it.each([
    ['the switch is off', () => isEnabled.mockResolvedValue(false)],
    ['the grant is gone', () => findProfessional.mockResolvedValue(null)],
    ['the practice is not paid for', () => findProfessional.mockResolvedValue({ practiceOpen: false, userId: PRO.id })]
  ])('is a 404 that reads nothing when %s — the second line behind the guard', async (_case, arrange) => {
    arrange();

    await expect(CareController.clients(PRO, NOW)).rejects.toBeInstanceOf(NotFoundError);
    expect(roster).not.toHaveBeenCalled();
  });
});

describe('CareController.accessLog', () => {
  it('reads the session’s own trail, newest first as stored, as who, what kind, read or write, and when', async () => {
    accessLog.mockResolvedValue([
      {
        id: '9a8b7c6d-5e4f-4a2b-8b8e-7f4a3c2d4e1f',
        action: 'read',
        createdAt: NOW,
        kind: 'health',
        professionalId: null,
        professionalName: 'Dra. Pérez',
        updatedAt: NOW,
        userId: CLIENT_ID
      }
    ]);

    const trail = await CareController.accessLog({ id: CLIENT_ID });

    expect(accessLog).toHaveBeenCalledWith(CLIENT_ID, 101, null);
    expect(trail).toEqual({
      entries: [
        { id: '9a8b7c6d-5e4f-4a2b-8b8e-7f4a3c2d4e1f', action: 'read', at: NOW.toISOString(), kind: 'health', professionalName: 'Dra. Pérez' }
      ],
      next: null
    });
  });

  it('pages: a full page names the next page’s start, and every row stays reachable', async () => {
    const row = (index: number): CareAccessEntry => ({
      id: `${String(index).padStart(8, '0')}-5e4f-4a2b-8b8e-7f4a3c2d4e1f`,
      action: 'read',
      createdAt: NOW,
      kind: 'list',
      professionalId: PRO.id,
      professionalName: 'Dra. Pérez',
      updatedAt: NOW,
      userId: CLIENT_ID
    });

    accessLog.mockResolvedValue(Array.from({ length: 101 }, (_, index) => row(index)));
    const first = await CareController.accessLog({ id: CLIENT_ID });

    expect(first.entries).toHaveLength(100);
    expect(first.next).toBe(row(99).id);

    accessLog.mockResolvedValue([row(100)]);
    const second = await CareController.accessLog({ id: CLIENT_ID }, first.next);

    expect(accessLog).toHaveBeenLastCalledWith(CLIENT_ID, 101, row(99).id);
    expect(second).toEqual({ entries: [expect.objectContaining({ id: row(100).id })], next: null });
  });

  it('refuses a cursor that is not a row id, before any query', async () => {
    await expect(CareController.accessLog({ id: CLIENT_ID }, 'not-an-id')).rejects.toThrow('Invalid cursor');
    expect(accessLog).not.toHaveBeenCalled();
  });

  it('answers whatever the switch says — what was read about somebody stays theirs to see', async () => {
    isEnabled.mockResolvedValue(false);
    accessLog.mockResolvedValue([]);

    await expect(CareController.accessLog({ id: CLIENT_ID })).resolves.toEqual({ entries: [], next: null });
    expect(isEnabled).not.toHaveBeenCalled();
  });
});

describe('review before publishing (0060)', () => {
  const TX = { transaction: 'the write’s' };
  const PLAN = { id: 'plan-2', status: 'active' } as PlanView;
  const JOB: JobView = { id: 'job-1', error: null, errorDetail: null, pendingReview: true, planId: 'plan-2', status: 'succeeded', step: 'done' };
  const JOB_ID = '2d3e4f5a-6b7c-4d8e-9f0a-1b2c3d4e5f6a';
  const MEAL_ID = '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f';
  const reviewRow = (action: CareAccessAction) => ({ action, kind: 'review', professionalId: PRO.id, professionalName: 'Dra. Pérez' });

  it('reads the pending plan through the link — one review read row, the client’s id from the link', async () => {
    activeLink.mockResolvedValue(access());
    getPendingPlan.mockResolvedValue(null);

    await expect(CareController.pendingPlan(PRO, LINK_ID, 'en-GB')).resolves.toBeNull();
    expect(logAccess).toHaveBeenCalledExactlyOnceWith(CLIENT_ID, reviewRow('read'));
    expect(getPendingPlan).toHaveBeenCalledWith(CLIENT_ID, 'en-GB');
  });

  it('follows a job as the professional, who is handed the plan id; a job id that is not an id is a 404 with no row', async () => {
    activeLink.mockResolvedValue(access());
    getJob.mockResolvedValue(JOB);

    await expect(CareController.planJob(PRO, LINK_ID, JOB_ID)).resolves.toBe(JOB);
    expect(getJob).toHaveBeenCalledWith(CLIENT_ID, JOB_ID, 'professional');

    logAccess.mockClear();
    await expect(CareController.planJob(PRO, LINK_ID, 'not-a-job')).rejects.toBeInstanceOf(NotFoundError);
    expect(logAccess).not.toHaveBeenCalled();
  });

  it('publishes with the row inside the publish’s transaction, and writes none when nothing is pending', async () => {
    activeLink.mockResolvedValue(access());
    publish.mockImplementation(async (_clientId, record) => {
      await record(TX as never);

      return PLAN;
    });

    await expect(CareController.publishPlan(PRO, LINK_ID)).resolves.toBe(PLAN);
    expect(publish).toHaveBeenCalledWith(CLIENT_ID, expect.any(Function), null);
    expect(logAccess).toHaveBeenCalledExactlyOnceWith(CLIENT_ID, reviewRow('write'), TX);

    logAccess.mockClear();
    publish.mockRejectedValue(new NotFoundError('Plan not found'));
    await expect(CareController.publishPlan(PRO, LINK_ID)).rejects.toBeInstanceOf(NotFoundError);
    expect(logAccess).not.toHaveBeenCalled();
  });

  it('hands the API’s generation and swap the client’s id and the write’s record — and a meal id that is not an id is a 404 before the link', async () => {
    activeLink.mockResolvedValue(access());
    const start = vi.fn(async (_clientId: string, record: RecordAccess) => {
      await record(TX as never);

      return JOB;
    });

    await expect(CareController.generatePlan(PRO, LINK_ID, start)).resolves.toBe(JOB);
    expect(start).toHaveBeenCalledWith(CLIENT_ID, expect.any(Function));
    expect(logAccess).toHaveBeenCalledExactlyOnceWith(CLIENT_ID, reviewRow('write'), TX);

    const swap = vi.fn();

    await expect(CareController.swapPendingMeal(PRO, LINK_ID, 'not-a-meal', swap)).rejects.toBeInstanceOf(NotFoundError);
    expect(swap).not.toHaveBeenCalled();
    expect(activeLink).toHaveBeenCalledOnce();

    await expect(CareController.swapPendingMeal(PRO, LINK_ID, MEAL_ID, async () => ({}) as never)).rejects.toBeInstanceOf(DatabaseOperationError);
  });

  it('turns review off for the link, with its row in the same transaction, and answers the link as its professional sees it', async () => {
    activeLink.mockResolvedValue(access());
    setReview.mockImplementation(async (_pro, _link, value, record) => {
      await record(TX as never);

      return makeLink({ reviewBeforePublish: value });
    });

    await expect(CareController.setReview(PRO, LINK_ID, { reviewBeforePublish: false })).resolves.toEqual({
      linkId: LINK_ID,
      name: 'Lucía',
      reviewBeforePublish: false,
      sharesHealth: false,
      since: NOW.toISOString(),
      status: 'active'
    });
    expect(setReview).toHaveBeenCalledWith(PRO.id, LINK_ID, false, expect.any(Function));
    expect(logAccess).toHaveBeenCalledExactlyOnceWith(CLIENT_ID, reviewRow('write'), TX);
  });

  it('is a 404 with no row when the link closed between resolving it and writing', async () => {
    activeLink.mockResolvedValue(access());
    setReview.mockResolvedValue(null);

    await expect(CareController.setReview(PRO, LINK_ID, { reviewBeforePublish: true })).rejects.toBeInstanceOf(NotFoundError);
    expect(logAccess).not.toHaveBeenCalled();
  });

  it('is a 404 with nothing reached for another professional’s link', async () => {
    activeLink.mockResolvedValue(null);
    const start = vi.fn();

    await expect(CareController.generatePlan({ id: 'usr-other-pro' }, LINK_ID, start)).rejects.toBeInstanceOf(NotFoundError);
    await expect(CareController.publishPlan({ id: 'usr-other-pro' }, LINK_ID)).rejects.toBeInstanceOf(NotFoundError);
    expect(start).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
    expect(logAccess).not.toHaveBeenCalled();
  });
});

describe('CareController.generatePlan — only when there is a reason (0060)', () => {
  const JOB: JobView = { id: 'job-1', error: null, errorDetail: null, pendingReview: false, planId: null, status: 'queued', step: null };

  it('generates when the rule allows it — no plan, a pending plan, or an ended fortnight — review on or off', async () => {
    activeLink.mockResolvedValue(access());
    const start = vi.fn(async (_clientId: string, record: RecordAccess) => {
      await record({} as never);

      return JOB;
    });

    await expect(CareController.generatePlan(PRO, LINK_ID, start)).resolves.toBe(JOB);

    activeLink.mockResolvedValue(access({ reviewBeforePublish: false }));
    await expect(CareController.generatePlan(PRO, LINK_ID, start)).resolves.toBe(JOB);
    expect(start).toHaveBeenCalledTimes(2);
    // The rule is asked of the client, never of the professional.
    expect(professionalMayGenerate).toHaveBeenCalledWith(CLIENT_ID);
  });

  it('never replaces a fortnight under way: a 404 with no row, and no generation started', async () => {
    const start = vi.fn();

    activeLink.mockResolvedValue(access());
    professionalMayGenerate.mockResolvedValue(false);
    await expect(CareController.generatePlan(PRO, LINK_ID, start)).rejects.toBeInstanceOf(NotFoundError);

    expect(start).not.toHaveBeenCalled();
    expect(logAccess).not.toHaveBeenCalled();
  });
});
