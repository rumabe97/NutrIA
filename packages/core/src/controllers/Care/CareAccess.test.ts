import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CARE_CONSENT_VERSION } from 'core/entities/Care';
import { DatabaseOperationError, NotFoundError } from 'core/entities/Error';

import { CareController } from './CareController';

import type { ActiveLink, Roster, RosterLink } from '#repositories/Care';
import type { CareAccessAction, CareAccessEntry, CareAccessKind, CareLink } from 'core/entities/Care';
import type { ProgressSummaryView } from 'core/controllers/Progress';
import type { SharedHealthView } from 'core/controllers/Health';

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
const logAccess = vi.fn<(clientId: string, entry: LogEntry) => Promise<void>>();
const roster = vi.fn<(professionalId: string, now: Date) => Promise<Roster>>();
const accessLog = vi.fn<(clientId: string, limit: number, beforeId: string | null) => Promise<readonly CareAccessEntry[]>>();
const findProfessional = vi.fn<(userId: string) => Promise<object | null>>();
const isEnabled = vi.fn<(key: string, fallback: boolean) => Promise<boolean>>();
const getActivePlan = vi.fn<(userId: string, locale: string | null) => Promise<null>>();
const listPlans = vi.fn<(userId: string) => Promise<readonly []>>();
const summary = vi.fn<(userId: string) => Promise<ProgressSummaryView>>();
const targets = vi.fn<(userId: string) => Promise<null>>();
const shared = vi.fn<(userId: string) => Promise<SharedHealthView>>();

vi.mock('#repositories/Care', () => ({
  CareRepository: {
    accessLog: (...args: Parameters<typeof accessLog>) => accessLog(...args),
    activeLink: (...args: Parameters<typeof activeLink>) => activeLink(...args),
    logAccess: (...args: Parameters<typeof logAccess>) => logAccess(...args),
    roster: (...args: Parameters<typeof roster>) => roster(...args)
  }
}));
vi.mock('#repositories/Professional', () => ({ ProfessionalRepository: { find: (userId: string) => findProfessional(userId) } }));
vi.mock('#repositories/Settings', () => ({ SettingsRepository: { isEnabled: (key: string, fallback: boolean) => isEnabled(key, fallback) } }));
vi.mock('core/controllers/Plan', () => ({
  PlanController: {
    getActivePlan: (...args: Parameters<typeof getActivePlan>) => getActivePlan(...args),
    listPlans: (userId: string) => listPlans(userId)
  }
}));
vi.mock('core/controllers/Progress', () => ({ ProgressController: { summary: (userId: string) => summary(userId) } }));
vi.mock('core/controllers/Profile', () => ({ ProfileController: { targets: (userId: string) => targets(userId) } }));
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
  for (const mock of [activeLink, logAccess, roster, accessLog, findProfessional, isEnabled, getActivePlan, listPlans, summary, targets, shared]) {
    mock.mockReset();
  }

  isEnabled.mockResolvedValue(true);
  findProfessional.mockResolvedValue({ userId: PRO.id });
  logAccess.mockResolvedValue(undefined);
  getActivePlan.mockResolvedValue(null);
  listPlans.mockResolvedValue([]);
  summary.mockResolvedValue(PROGRESS);
  targets.mockResolvedValue(null);
  shared.mockResolvedValue(HEALTH);
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
    ['the grant is gone', () => findProfessional.mockResolvedValue(null)]
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
