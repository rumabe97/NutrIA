import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CARE_CONSENT_VERSION } from 'core/entities/Care';
import { PROFESSIONAL_AGREEMENT_VERSION } from 'core/entities/Professional';
import { DatabaseOperationError, InputParseError, NotFoundError } from 'core/entities/Error';

import { CareController } from './CareController';

import type { ActiveLink, linkScope as linkScopeFn, Roster, RosterLink } from '#repositories/Care';
import type { blocksPractice as blocksPracticeFn, RestrictionStanding } from '#repositories/Professional';
import type { CareAccessAction, CareAccessEntry, CareAccessKind, CareConsentScope, CareLink } from 'core/entities/Care';
import type { CareClientOverviewView, CareClientPageView } from './CareController';
import type {
  JobView,
  MealDetailView,
  planOnly,
  planOnlyJob,
  planOnlyMealDetail,
  planOnlySummary,
  PlanSummaryView,
  PlanView,
  withoutPantry
} from 'core/controllers/Plan';
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

/** The plan presenters taken from the real module. */
type PlanPresenters = {
  readonly planOnly: typeof planOnly;
  readonly planOnlyJob: typeof planOnlyJob;
  readonly planOnlyMealDetail: typeof planOnlyMealDetail;
  readonly planOnlySummary: typeof planOnlySummary;
  readonly withoutPantry: typeof withoutPantry;
};

type LogEntry = {
  readonly action: CareAccessAction;
  readonly kind: CareAccessKind;
  readonly linkId: string;
  readonly professionalId: string;
  readonly professionalName: string;
};

const activeLink = vi.fn<(professionalId: string, linkId: string) => Promise<ActiveLink | null>>();
const logAccess = vi.fn<(clientId: string, entry: LogEntry, tx?: unknown) => Promise<void>>();
const roster = vi.fn<(professionalId: string, now: Date) => Promise<Roster>>();
const accessLog = vi.fn<(clientId: string, limit: number, beforeId: string | null) => Promise<readonly CareAccessEntry[]>>();
const findProfessional = vi.fn<(userId: string) => Promise<object | null>>();
const standing = vi.fn<(userId: string) => Promise<RestrictionStanding>>();
const isEnabled = vi.fn<(key: string, fallback: boolean) => Promise<boolean>>();
const getActivePlan = vi.fn<(userId: string, locale: string | null, throughLink?: string) => Promise<PlanView | null>>();
const listPlans =
  vi.fn<(userId: string, limit?: number, offset?: number, reader?: string, throughLink?: string) => Promise<readonly PlanSummaryView[]>>();
const summary = vi.fn<(userId: string) => Promise<ProgressSummaryView>>();
const targets = vi.fn<(userId: string) => Promise<ResolvedTargets | null>>();
const updateTargets = vi.fn<(userId: string, patch: UpdateTargetOverride, setter?: ProfessionalSetter | null) => Promise<ResolvedTargets>>();
const shared = vi.fn<(userId: string) => Promise<SharedHealthView>>();
const setReview = vi.fn<(professionalId: string, linkId: string, value: boolean, record: RecordAccess) => Promise<CareLink | null>>();
const getPendingPlan = vi.fn<(userId: string, locale: string | null, throughLink?: string) => Promise<PlanView | null>>();
const getJob =
  vi.fn<(userId: string, jobId: string, reader: string, throughLink?: { readonly id: string; readonly since: Date }) => Promise<JobView>>();
const publish =
  vi.fn<(userId: string, record: RecordAccess, link: { readonly id: string; readonly only: boolean }, locale: string | null) => Promise<PlanView>>();
const professionalMayGenerate = vi.fn<(userId: string) => Promise<boolean>>();
const pendingThrough = vi.fn<(userId: string, linkId: string) => Promise<boolean>>();

vi.mock('#repositories/Care', async () => ({
  CareRepository: {
    accessLog: (...args: Parameters<typeof accessLog>) => accessLog(...args),
    activeLink: (...args: Parameters<typeof activeLink>) => activeLink(...args),
    logAccess: (...args: Parameters<typeof logAccess>) => logAccess(...args),
    roster: (...args: Parameters<typeof roster>) => roster(...args),
    setReview: (...args: Parameters<typeof setReview>) => setReview(...args)
  },
  // The real rule: `activeProfessional` and the roster's stage are what some of these cases are about.
  linkScope: (await vi.importActual<{ linkScope: typeof linkScopeFn }>('../../repositories/Care/CareScope')).linkScope
}));
vi.mock('#repositories/Professional', async () => ({
  // The real rule (project 025 phase 6): what a restriction refuses is decided in one place.
  blocksPractice: (
    await vi.importActual<{ blocksPractice: typeof blocksPracticeFn }>('../../repositories/Professional/PracticeRestrictionRepository')
  ).blocksPractice,
  PracticeRestrictionRepository: { standing: (userId: string) => standing(userId) },
  // `withClient` never reads the badge itself: `activeLink` answers the scope. Any call here is a second definition.
  ProfessionalBadgeRepository: { badgeOf: () => Promise.reject(new Error('the badge is read by the repository, not here')) },
  ProfessionalRepository: { find: (userId: string) => findProfessional(userId) }
}));
vi.mock('#repositories/Settings', () => ({ SettingsRepository: { isEnabled: (key: string, fallback: boolean) => isEnabled(key, fallback) } }));
vi.mock('core/controllers/Plan', async () => {
  const actual = await vi.importActual<PlanPresenters>('../Plan/PlanController');

  return {
    PlanController: {
      getActivePlan: (...args: Parameters<typeof getActivePlan>) => getActivePlan(...args),
      getJob: (...args: Parameters<typeof getJob>) => getJob(...args),
      getPendingPlan: (...args: Parameters<typeof getPendingPlan>) => getPendingPlan(...args),
      listPlans: (...args: Parameters<typeof listPlans>) => listPlans(...args),
      pendingThrough: (...args: Parameters<typeof pendingThrough>) => pendingThrough(...args),
      professionalMayGenerate: (userId: string) => professionalMayGenerate(userId),
      publish: (...args: Parameters<typeof publish>) => publish(...args)
    },
    // The real presenters, not stubs: what crosses to a professional — the
    // cupboard's counts (`legal` P2-9), and under a `plan` scope the client's
    // numbers (`0111` § 4) — is what these cases are about.
    planOnly: actual.planOnly,
    planOnlyJob: actual.planOnlyJob,
    planOnlyMealDetail: actual.planOnlyMealDetail,
    planOnlySummary: actual.planOnlySummary,
    withoutPantry: actual.withoutPantry
  };
});
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
    consentScope: 'full',
    consentVersion: CARE_CONSENT_VERSION,
    createdAt: NOW,
    endedAt: null,
    endedBy: null,
    narrowedAt: null,
    professionalId: PRO.id,
    reviewBeforePublish: true,
    scopeConsentedAt: null,
    scopeConsentVersion: null,
    sharesHealth: false,
    status: 'active',
    updatedAt: NOW,
    ...overrides
  };
}

function access(overrides?: Partial<CareLink>, scope: CareConsentScope = 'full'): ActiveLink {
  return { clientName: 'Lucía', link: makeLink(overrides), professionalName: 'Dra. Pérez', scope };
}

/** The full page, narrowed: a `full` scope's answer carries `progress`. */
function full(page: CareClientPageView): CareClientOverviewView {
  if (!('progress' in page)) {
    throw new Error('expected the full page');
  }

  return page;
}

function rosterLink(overrides?: Partial<RosterLink>): RosterLink {
  return {
    clientName: 'Lucía',
    latestPlan: null,
    link: { id: LINK_ID, consentedAt: NOW, reviewBeforePublish: true, sharesHealth: false, status: 'active' },
    onboarded: true,
    planActive: false,
    planPendingReview: false,
    scope: 'full',
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
    professionalMayGenerate,
    pendingThrough
  ]) {
    mock.mockReset();
  }

  isEnabled.mockResolvedValue(true);
  // A free practice (PRD 025 scope 2): nobody pays, and it works.
  findProfessional.mockResolvedValue({ agreementVersion: PROFESSIONAL_AGREEMENT_VERSION, practiceOpen: false, userId: PRO.id });
  standing.mockReset();
  standing.mockResolvedValue({ closing: null, suspended: null });
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
      linkId: LINK_ID,
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
    expect(listPlans).toHaveBeenCalledWith(CLIENT_ID, undefined, undefined, 'professional');
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
    expect(full(page).health).toEqual(HEALTH);
    // A `full` scope reads the health line as it is: nothing masked there.
    expect(page.client.sharesHealth).toBe(true);
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
          locked: false,
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
          locked: false,
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
          locked: false,
          meals: { eaten: 0, skipped: 0, soFar: 0 },
          planId: 'plan-x',
          replaced: false,
          startDate: '2026-08-13',
          status: 'completed',
          version: -1
        }
      ]
    });

    const page = full(await CareController.overview(PRO, LINK_ID));

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
          locked: false,
          meals: { eaten: 12, skipped: 2, soFar: 14 },
          planId: 'plan-1',
          replaced: false,
          startDate: '2026-09-10',
          status: 'active',
          version: 1
        }
      ]
    });

    const page = full(await CareController.overview(PRO, LINK_ID));

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
      { action: 'write', kind: 'targets', linkId: LINK_ID, professionalId: PRO.id, professionalName: 'Dra. Pérez' },
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
        rosterLink({ latestPlan: { answered: false, endDate: '2026-09-24', timeZone: 'Europe/Madrid' }, link: link(1), planActive: true }),
        rosterLink({ latestPlan: { answered: false, endDate: '2026-09-25', timeZone: 'Europe/Madrid' }, link: link(2), planActive: true }),
        rosterLink({ latestPlan: { answered: true, endDate: '2026-09-20', timeZone: 'Europe/Madrid' }, link: link(3) }),
        rosterLink({
          latestPlan: { answered: false, endDate: '2026-09-20', timeZone: 'Europe/Madrid' },
          link: link(4),
          planActive: true,
          planPendingReview: true
        }),
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

  it("reads a check-in as due on the client's own day, in the zone their profile keeps", async () => {
    // 00:30 on the 25th in Madrid, still the 24th in UTC and in New York.
    const late = new Date('2026-09-24T22:30:00.000Z');
    const closing = (timeZone: string | null) => rosterLink({ latestPlan: { answered: false, endDate: '2026-09-25', timeZone }, planActive: true });

    roster.mockResolvedValue({ invitations: [], links: [closing('Europe/Madrid'), closing(null), closing('America/New_York')] });

    const view = await CareController.clients(PRO, late);

    expect(view.clients.map(client => client.stage)).toEqual(['check_in_due', 'check_in_due', 'plan_under_way']);
  });

  it('names no client id, and writes no row of its own beyond what the repository writes in its snapshot', async () => {
    roster.mockResolvedValue({ invitations: [], links: [rosterLink()] });

    const view = await CareController.clients(PRO, NOW);

    expect(logAccess).not.toHaveBeenCalled();
    expect(Object.keys(view.clients[0] ?? {}).sort()).toEqual(['linkId', 'name', 'reviewBeforePublish', 'sharesHealth', 'since', 'stage', 'status']);
  });

  /*
   * Legal F4 (PRD 025 criterion 22, PLAN phase 5 step 5): how a link ended never
   * reaches its practitioner. The list holds open links only, so an ended one —
   * whoever or whatever ended it, the illness rule included — simply leaves it,
   * the same way; and no row of it carries who ended anything.
   */
  it('carries no word of how a link ended, and lists no ended link — whoever ended it', async () => {
    roster.mockResolvedValue({ invitations: [], links: [rosterLink(), rosterLink({ link: { ...rosterLink().link, status: 'paused' } })] });

    const view = await CareController.clients(PRO, NOW);
    const text = JSON.stringify(view);

    for (const word of ['endedBy', 'endedAt', 'ended', 'badge_lost', 'lapse']) {
      expect(text).not.toContain(word);
    }

    expect(view.clients.map(client => client.status)).toEqual(['active', 'paused']);
  });

  it.each([
    ['the switch is off', () => isEnabled.mockResolvedValue(false)],
    ['the practice is gone', () => findProfessional.mockResolvedValue(null)],
    ['the agreement was never accepted', () => findProfessional.mockResolvedValue({ agreementVersion: null, practiceOpen: true, userId: PRO.id })],
    [
      'the agreement accepted is not the current one',
      () => findProfessional.mockResolvedValue({ agreementVersion: '0.9.0', practiceOpen: true, userId: PRO.id })
    ],
    // PRD 025 criterion 24: the one reader, asked on every call.
    ['the practitioner is suspended', () => standing.mockResolvedValue({ closing: null, suspended: { actedAt: NOW, reason: 'facts' } })],
    [
      'the practice’s close has come',
      () => standing.mockResolvedValue({ closing: { id: 'close', actedAt: NOW, actedBy: null, effectiveAt: NOW, reason: 'facts' }, suspended: null })
    ]
  ])('is a 404 that reads nothing when %s — the second line behind the guard', async (_case, arrange) => {
    arrange();

    await expect(CareController.clients(PRO, NOW)).rejects.toBeInstanceOf(NotFoundError);
    expect(roster).not.toHaveBeenCalled();
  });

  /* PRD 025 scope 2: `practiceOpen` left the access check. */
  it('lists the clients of a practice nobody pays for, and of a close not yet come', async () => {
    findProfessional.mockResolvedValue({ agreementVersion: PROFESSIONAL_AGREEMENT_VERSION, practiceOpen: false, userId: PRO.id });
    standing.mockResolvedValue({
      closing: { id: 'close', actedAt: NOW, actedBy: null, effectiveAt: new Date(NOW.getTime() + 24 * 60 * 60 * 1000), reason: 'facts' },
      suspended: null
    });
    roster.mockResolvedValue({ invitations: [], links: [] });

    await expect(CareController.clients(PRO, NOW)).resolves.toEqual({ clients: [], invitations: [] });
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
        linkId: LINK_ID,
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
        {
          id: '9a8b7c6d-5e4f-4a2b-8b8e-7f4a3c2d4e1f',
          action: 'read',
          at: NOW.toISOString(),
          kind: 'health',
          linkId: LINK_ID,
          professionalName: 'Dra. Pérez'
        }
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
      linkId: null,
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
  const PLAN = { id: 'plan-2', pantry: { coveredRows: 19, meals: 54, rows: 105, wholeMeals: 9 }, status: 'active' } as PlanView;
  /** The same plan as it may cross to a professional: the four pantry counts off it. */
  const SHARED = { id: 'plan-2', status: 'active' };
  const JOB: JobView = { id: 'job-1', error: null, errorDetail: null, pendingReview: true, planId: 'plan-2', status: 'succeeded', step: 'done' };
  const JOB_ID = '2d3e4f5a-6b7c-4d8e-9f0a-1b2c3d4e5f6a';
  const MEAL_ID = '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f';
  const reviewRow = (action: CareAccessAction) => ({
    action,
    kind: 'review',
    linkId: LINK_ID,
    professionalId: PRO.id,
    professionalName: 'Dra. Pérez'
  });

  it('reads the pending plan through the link — one review read row, the client’s id from the link', async () => {
    activeLink.mockResolvedValue(access());
    getPendingPlan.mockResolvedValue(null);

    await expect(CareController.pendingPlan(PRO, LINK_ID, 'en-GB')).resolves.toBeNull();
    expect(logAccess).toHaveBeenCalledExactlyOnceWith(CLIENT_ID, reviewRow('read'));
    expect(getPendingPlan).toHaveBeenCalledWith(CLIENT_ID, 'en-GB');
  });

  it('does not show the professional what the client’s cupboard did', async () => {
    activeLink.mockResolvedValue(access());
    getPendingPlan.mockResolvedValue(PLAN);

    // `/privacidad` § «Tu dietista en NutrIA» enumerates what crosses, and four
    // counts no care screen reads do not join that list by type alias
    // (`legal` P2-9, and the lead's ruling, 2026-11-03).
    await expect(CareController.pendingPlan(PRO, LINK_ID)).resolves.toEqual(SHARED);
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

    // The counts are off it here too: publishing is the same boundary read from
    // the other side.
    await expect(CareController.publishPlan(PRO, LINK_ID)).resolves.toEqual(SHARED);
    expect(publish).toHaveBeenCalledWith(CLIENT_ID, expect.any(Function), { id: LINK_ID, only: false }, null);
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

describe('what the client’s plan carries across the care boundary (legal P2-9)', () => {
  it('leaves the cupboard’s counts off the client page’s plan', async () => {
    activeLink.mockResolvedValue(access());
    getActivePlan.mockResolvedValue({ id: 'plan-3', pantry: { coveredRows: 19, meals: 54, rows: 105, wholeMeals: 9 }, status: 'active' } as PlanView);

    const page = await CareController.overview(PRO, LINK_ID);

    expect(page.plan).toEqual({ id: 'plan-3', status: 'active' });
    expect(JSON.stringify(page)).not.toContain('coveredRows');
  });
});

/*
 * Project 025 phase 4 (`0111` §§ 4–5, PRD 025 criteria 9–15): a link whose
 * practitioner holds no badge, or whose client consented to the plan list
 * only, opens `plan` — the plans made through the link and nothing else, by
 * any route, with every other kind the 404 of every denial.
 */
describe('a `plan` scope — the narrower view, in core (project 025)', () => {
  const MEAL = {
    id: 'meal-1',
    accompaniments: [],
    carbsG: 60,
    cookMinutes: 20,
    difficulty: 'easy',
    fatG: 15,
    fiberG: 8,
    illustrationPath: null,
    ingredients: [{ grams: 120, name: 'Garbanzos' }],
    kcal: 520,
    name: 'Garbanzos con espinacas',
    prepMinutes: 10,
    proteinG: 25,
    recipeId: 'recipe-1',
    servings: 1,
    slot: 'lunch',
    status: 'eaten'
  } as const;
  /** The same meal as a `plan` scope reads it: everything but whether it was eaten. */
  const { status: _eaten, ...MEAL_ONLY } = MEAL;
  const TARGETS = { carbsG: 200, fatG: 60, fiberG: 28, kcal: 2000, proteinG: 120 };
  const FULL_PLAN: PlanView = {
    id: 'plan-9',
    days: [
      {
        date: '2026-11-18',
        dayIndex: 0,
        // The client's own words for an event: never the practitioner's to read.
        loadedFor: 'Revisión de la diabetes',
        meals: [MEAL],
        targets: TARGETS,
        totals: { carbsG: 60, fatG: 15, fiberG: 8, kcal: 520, proteinG: 25 }
      }
    ],
    endDate: '2026-12-01',
    pantry: null,
    startDate: '2026-11-18',
    status: 'active',
    strategy: TARGETS,
    version: 3
  };
  const MEAL_DETAIL = {
    id: 'meal-1',
    accompaniments: [],
    carbsG: 60,
    cookMinutes: 20,
    cuisine: null,
    date: '2026-11-18',
    dayIndex: 0,
    difficulty: 'easy',
    equipment: [],
    fatG: 15,
    fiberG: 8,
    illustrationPath: null,
    ingredients: [],
    kcal: 520,
    name: 'Garbanzos con espinacas',
    pictureStatus: 'none',
    planEndDate: '2026-12-01',
    planId: 'plan-9',
    planStatus: 'pending_review',
    prepMinutes: 10,
    proteinG: 25,
    recipeId: 'recipe-1',
    servings: 1,
    slot: 'lunch',
    status: 'planned',
    steps: [],
    verdict: 'disliked'
  } as const satisfies MealDetailView;
  /** A line of the history as stored for the client: `version` 14 says thirteen plans came first. */
  const SUMMARY: PlanSummaryView = {
    id: 'plan-9',
    endDate: '2026-12-01',
    locked: false,
    replaced: false,
    startDate: '2026-11-18',
    status: 'active',
    version: 14
  };
  const JOB_ID = '2d3e4f5a-6b7c-4d8e-9f0a-1b2c3d4e5f6a';
  const MEAL_ID = '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f';
  /** What a `plan` scope may never be handed, at any depth of any answer (PRD 025 criterion 9). */
  const NEVER = ['adherence', 'checkIn', 'health', 'loadedFor', 'progress', 'strategy', 'suggestedKcal', 'targets', 'verdict', 'version', 'weight'];

  /** Every key at every depth, with the meal keys apart: a meal's `status` is adherence, a plan's is not. */
  function keysOf(value: unknown, into: Set<string> = new Set(), inMeals = false): Set<string> {
    if (Array.isArray(value)) {
      for (const item of value) {
        keysOf(item, into, inMeals);
      }
    } else if (value !== null && typeof value === 'object') {
      for (const [key, child] of Object.entries(value)) {
        into.add(inMeals ? `meal.${key}` : key);
        keysOf(child, into, key === 'meals');
      }
    }

    return into;
  }

  function assertPlanOnly(answer: unknown): void {
    const keys = keysOf(answer);

    for (const key of NEVER) {
      expect(keys.has(key)).toBe(false);
    }

    expect(keys.has('meal.status')).toBe(false);
    expect(JSON.stringify(answer)).not.toContain(CLIENT_ID);
  }

  const start = (job: JobView) =>
    vi.fn(async (_clientId: string, record: RecordAccess) => {
      await record({} as never);

      return job;
    });

  describe('withClient, one case per `CARE_ACCESS_KINDS` value', () => {
    it.each([
      ['overview', 'read'],
      ['plan', 'read'],
      ['review', 'read'],
      ['review', 'write']
    ] as const)('lets `%s` (%s) through, with its row, and hands the callback the scope', async (kind, action) => {
      activeLink.mockResolvedValue(access({}, 'plan'));
      const fn = vi.fn(async (_clientId: string, resolved: { readonly scope: CareConsentScope }, record: RecordAccess) => {
        if (action === 'write') {
          await record({} as never);
        }

        return resolved.scope;
      });

      await expect(CareController.withClient(PRO.id, LINK_ID, kind, action, fn)).resolves.toBe('plan');
      expect(logAccess).toHaveBeenCalledExactlyOnceWith(CLIENT_ID, expect.objectContaining({ action, kind }), ...(action === 'write' ? [{}] : []));
    });

    it.each([
      ['progress', 'read'],
      ['progress', 'write'],
      ['targets', 'read'],
      ['targets', 'write'],
      ['health', 'read'],
      ['health', 'write']
    ] as const)('refuses `%s` (%s) with the 404 of every denial, nothing written and nothing read', async (kind, action) => {
      // The health line said yes: under `plan` it still opens nothing.
      activeLink.mockResolvedValue(access({ sharesHealth: true }, 'plan'));
      const fn = vi.fn(async () => 'read');

      const refused = CareController.withClient(PRO.id, LINK_ID, kind, action, fn);

      await expect(refused).rejects.toBeInstanceOf(NotFoundError);
      await expect(refused).rejects.toThrow('Client not found');
      expect(fn).not.toHaveBeenCalled();
      expect(logAccess).not.toHaveBeenCalled();
    });

    it('`list` is the roster’s alone, and under a `plan` scope it never says a check-in is due', async () => {
      roster.mockResolvedValue({
        invitations: [],
        links: [
          // A repository that forgot to drop `latestPlan` still yields no check-in stage.
          rosterLink({
            latestPlan: { answered: false, endDate: '2026-09-24', timeZone: 'Europe/Madrid' },
            link: { id: LINK_ID, consentedAt: NOW, reviewBeforePublish: true, sharesHealth: true, status: 'active' },
            planActive: true,
            scope: 'plan'
          }),
          rosterLink({ latestPlan: null, planActive: true, scope: 'plan' }),
          rosterLink({ latestPlan: { answered: false, endDate: '2026-09-24', timeZone: 'Europe/Madrid' }, planActive: true })
        ]
      });

      const view = await CareController.clients(PRO, NOW);

      expect(view.clients.map(client => client.stage)).toEqual(['plan_under_way', 'plan_under_way', 'check_in_due']);
      // A health line said yes in a badged time reads `false` to a `plan` scope.
      expect(view.clients[0]?.sharesHealth).toBe(false);
      expect(Object.keys(view.clients[0] ?? {}).sort()).toEqual([
        'linkId',
        'name',
        'reviewBeforePublish',
        'sharesHealth',
        'since',
        'stage',
        'status'
      ]);
    });

    it('asks the scope of the link afresh on every call: a badge lost narrows the very next request', async () => {
      activeLink.mockResolvedValueOnce(access()).mockResolvedValueOnce(access({}, 'plan'));

      await expect(CareController.withClient(PRO.id, LINK_ID, 'targets', 'read', async () => 'read')).resolves.toBe('read');
      await expect(CareController.withClient(PRO.id, LINK_ID, 'targets', 'read', async () => 'read')).rejects.toBeInstanceOf(NotFoundError);
      expect(activeLink).toHaveBeenCalledTimes(2);
    });
  });

  describe('the client’s page', () => {
    it('is the plans made through this link, plan-only — no progress, targets or health key, and none of them read', async () => {
      activeLink.mockResolvedValue(access({ sharesHealth: true }, 'plan'));
      getActivePlan.mockResolvedValue(FULL_PLAN);
      listPlans.mockResolvedValue([SUMMARY]);

      const page = await CareController.overview(PRO, LINK_ID, 'en-GB');

      expect(Object.keys(page).sort()).toEqual(['client', 'plan', 'plans']);
      expect(getActivePlan).toHaveBeenCalledWith(CLIENT_ID, 'en-GB', LINK_ID);
      expect(listPlans).toHaveBeenCalledWith(CLIENT_ID, undefined, undefined, 'professional', LINK_ID);
      expect(summary).not.toHaveBeenCalled();
      expect(targets).not.toHaveBeenCalled();
      expect(shared).not.toHaveBeenCalled();
      expect(logAccess).toHaveBeenCalledExactlyOnceWith(CLIENT_ID, expect.objectContaining({ action: 'read', kind: 'overview' }));
      expect(page.plan).toEqual({
        id: 'plan-9',
        days: [{ date: '2026-11-18', dayIndex: 0, meals: [MEAL_ONLY], totals: { carbsG: 60, fatG: 15, fiberG: 8, kcal: 520, proteinG: 25 } }],
        endDate: '2026-12-01',
        startDate: '2026-11-18',
        status: 'active'
      });
      expect(page.plans).toEqual([
        { id: 'plan-9', endDate: '2026-12-01', locked: false, replaced: false, startDate: '2026-11-18', status: 'active' }
      ]);
      expect(page.client.sharesHealth).toBe(false);
      expect(JSON.stringify(page)).not.toContain('diabetes');
      assertPlanOnly(page);
    });

    it('has no plan when the one under way was not made through this link', async () => {
      activeLink.mockResolvedValue(access({}, 'plan'));
      getActivePlan.mockResolvedValue(null);

      await expect(CareController.overview(PRO, LINK_ID)).resolves.toMatchObject({ plan: null, plans: [] });
    });
  });

  describe('the review routes', () => {
    it('reads only a pending plan made through this link, plan-only', async () => {
      activeLink.mockResolvedValue(access({}, 'plan'));
      getPendingPlan.mockResolvedValue({ ...FULL_PLAN, status: 'pending_review' });

      const plan = await CareController.pendingPlan(PRO, LINK_ID, 'en-GB');

      expect(getPendingPlan).toHaveBeenCalledWith(CLIENT_ID, 'en-GB', LINK_ID);
      expect(plan).toMatchObject({ id: 'plan-9', status: 'pending_review' });
      assertPlanOnly(plan);
    });

    it('follows a job through this link only, and never with its detail — a rejected plan’s detail quotes the targets', async () => {
      activeLink.mockResolvedValue(access({}, 'plan'));
      getJob.mockResolvedValue({
        id: 'job-1',
        error: 'GENERATION_INVALID_PLAN',
        errorDetail: 'kcal_out_of_band (3 días, p. ej. 2300 frente a 2000)',
        pendingReview: false,
        planId: null,
        status: 'failed',
        step: null
      });

      await expect(CareController.planJob(PRO, LINK_ID, JOB_ID)).resolves.toEqual({
        id: 'job-1',
        error: 'GENERATION_INVALID_PLAN',
        errorDetail: null,
        pendingReview: false,
        planId: null,
        status: 'failed',
        step: null
      });
      // Bounded by the link: its id, and since when it stands (a job from before it is not found).
      expect(getJob).toHaveBeenCalledWith(CLIENT_ID, JOB_ID, 'professional', { id: LINK_ID, since: NOW });
    });

    it('generates, and hands back the job without its detail', async () => {
      activeLink.mockResolvedValue(access({}, 'plan'));
      const generation = start({
        id: 'job-1',
        error: null,
        errorDetail: 'provider says',
        pendingReview: false,
        planId: null,
        status: 'queued',
        step: null
      });

      await expect(CareController.generatePlan(PRO, LINK_ID, generation)).resolves.toMatchObject({ errorDetail: null, status: 'queued' });
      expect(generation).toHaveBeenCalledWith(CLIENT_ID, expect.any(Function));
      expect(logAccess).toHaveBeenCalledExactlyOnceWith(CLIENT_ID, expect.objectContaining({ action: 'write', kind: 'review' }), {});
    });

    it('publishes only a plan made through this link, and answers it plan-only', async () => {
      activeLink.mockResolvedValue(access({}, 'plan'));
      publish.mockImplementation(async (_clientId, record) => {
        await record({} as never);

        return FULL_PLAN;
      });

      const published = await CareController.publishPlan(PRO, LINK_ID, 'en-GB');

      expect(publish).toHaveBeenCalledWith(CLIENT_ID, expect.any(Function), { id: LINK_ID, only: true }, 'en-GB');
      assertPlanOnly(published);
    });

    it('swaps only in a pending plan made through this link, and answers the meal without its status', async () => {
      activeLink.mockResolvedValue(access({}, 'plan'));
      pendingThrough.mockResolvedValue(true);
      const swap = vi.fn(async (_clientId: string, record: RecordAccess) => {
        await record({} as never);

        return MEAL_DETAIL;
      });

      const meal = await CareController.swapPendingMeal(PRO, LINK_ID, MEAL_ID, swap);

      expect(pendingThrough).toHaveBeenCalledWith(CLIENT_ID, LINK_ID);
      expect(meal).not.toHaveProperty('status');
      expect(meal).not.toHaveProperty('verdict');
      expect(meal).toMatchObject({ id: 'meal-1', planStatus: 'pending_review' });
      assertPlanOnly(meal);
    });

    it('turns review on or off, and answers the link with the health line masked', async () => {
      activeLink.mockResolvedValue(access({ sharesHealth: true }, 'plan'));
      setReview.mockImplementation(async (_pro, _link, value, record) => {
        await record({} as never);

        return makeLink({ reviewBeforePublish: value, sharesHealth: true });
      });

      await expect(CareController.setReview(PRO, LINK_ID, { reviewBeforePublish: false })).resolves.toMatchObject({
        reviewBeforePublish: false,
        sharesHealth: false
      });
    });
  });

  /*
   * PRD 025 criterion 13 (`0013` § 5.3): no answer to a `plan` scope names an
   * allergen, an intolerance or a condition. Every refusal core gives on the
   * three acting routes is one fixed sentence, the same as for a stranger.
   */
  describe('every refusal names nothing of the client', () => {
    const NEUTRAL = new Set(['Client not found', 'Meal not found', 'Plan not found', 'Job not found']);

    async function refusal(promise: Promise<unknown>): Promise<string> {
      const error = await promise.then(
        () => {
          throw new Error('expected a refusal');
        },
        (caught: unknown) => caught
      );

      expect(error).toBeInstanceOf(NotFoundError);

      return (error as Error).message;
    }

    beforeEach(() => {
      activeLink.mockResolvedValue(access({}, 'plan'));
    });

    it('generate: a fortnight under way', async () => {
      professionalMayGenerate.mockResolvedValue(false);

      expect(NEUTRAL.has(await refusal(CareController.generatePlan(PRO, LINK_ID, vi.fn())))).toBe(true);
    });

    it('generate, swap and publish: a link that is not open to this practitioner', async () => {
      activeLink.mockResolvedValue(null);

      for (const attempt of [
        CareController.generatePlan(PRO, LINK_ID, vi.fn()),
        CareController.swapPendingMeal(PRO, LINK_ID, MEAL_ID, vi.fn()),
        CareController.publishPlan(PRO, LINK_ID)
      ]) {
        expect(NEUTRAL.has(await refusal(attempt))).toBe(true);
      }
    });

    it('swap: a pending plan not made through this link — nothing swapped, no row', async () => {
      pendingThrough.mockResolvedValue(false);
      const swap = vi.fn();

      expect(NEUTRAL.has(await refusal(CareController.swapPendingMeal(PRO, LINK_ID, MEAL_ID, swap)))).toBe(true);
      expect(swap).not.toHaveBeenCalled();
      expect(logAccess).not.toHaveBeenCalled();
    });

    it('swap: a meal id that is not one', async () => {
      expect(NEUTRAL.has(await refusal(CareController.swapPendingMeal(PRO, LINK_ID, 'not-a-meal', vi.fn())))).toBe(true);
    });

    it('publish: nothing pending through this link', async () => {
      publish.mockRejectedValue(new NotFoundError('Plan not found'));

      expect(NEUTRAL.has(await refusal(CareController.publishPlan(PRO, LINK_ID)))).toBe(true);
    });

    it('a job whose plan was not made through this link', async () => {
      getJob.mockRejectedValue(new NotFoundError('Job not found'));

      expect(NEUTRAL.has(await refusal(CareController.planJob(PRO, LINK_ID, JOB_ID)))).toBe(true);
    });

    it('targets, read or written: the 404 of an unknown client', async () => {
      expect(await refusal(CareController.setTargets(PRO, LINK_ID, { kcal: 1800 } as UpdateTargetOverride))).toBe('Client not found');
      expect(updateTargets).not.toHaveBeenCalled();
    });
  });
});
