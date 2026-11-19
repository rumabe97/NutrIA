import { beforeEach, describe, expect, it, vi } from 'vitest';

import { makeProfessional, makeProfile, makeUser } from '#test/fixtures';
import { NotFoundError } from 'core/entities/Error';
import { PROFESSIONAL_AGREEMENT_VERSION } from 'core/entities/Professional';

import { ProfessionalController } from './ProfessionalController';

import type * as Repositories from '#repositories/Professional';
import type { Badge, ProfessionalListRow, RestrictionAct, RestrictionStanding, StandingClose } from '#repositories/Professional';
import type { PracticeRestrictionKind, Professional, ProfessionalProfile } from 'core/entities/Professional';
import type { Profile } from 'core/entities/Profile';
import type { ProfessionalQuery } from 'core/entities/AdminQuery';
import type { User } from 'core/entities/User';

type CloseHooks = {
  readonly endLinks: (tx: unknown) => Promise<unknown>;
  readonly record?: (tx: never) => Promise<void>;
  readonly whenWithdrawn?: (tx: unknown) => Promise<unknown>;
};
type Decide = (standing: RestrictionStanding, practising: boolean) => boolean;
type Row = { actedBy: string; effectiveAt: Date | null; kind: PracticeRestrictionKind; reason: string | null };

const acceptAgreement = vi.fn<(userId: string, version: string, now: Date) => Promise<Professional | null>>();
const find = vi.fn<(userId: string) => Promise<Professional | null>>();
const list = vi.fn<(query: ProfessionalQuery) => Promise<readonly ProfessionalListRow[]>>();
const open =
  vi.fn<
    (
      userId: string,
      birth: { birthDate: string | null; locale: string | null },
      now: Date,
      barred: (tx: unknown) => Promise<boolean>
    ) => Promise<'barred' | 'exists' | 'opened'>
  >();
const close =
  vi.fn<
    (userId: string, closingId: string, now: Date, withdrawal: { checkedBy: string | null; reason: string }, hooks: CloseHooks) => Promise<boolean>
  >();
const endLinksOf = vi.fn<(professionalId: string, now: Date, tx: unknown) => Promise<number>>();
type Record = (tx: unknown, act: RestrictionAct) => Promise<unknown>;

const act = vi.fn<(userId: string, row: Row, decide: Decide, record?: Record) => Promise<RestrictionAct | null>>();
const auditRecord = vi.fn<(entry: unknown, tx?: unknown) => Promise<void>>();
const listWithoutPractice = vi.fn<(query: ProfessionalQuery) => Promise<readonly ProfessionalListRow[]>>();
const standing = vi.fn<(userId: string, db?: unknown) => Promise<RestrictionStanding>>();
const standings = vi.fn<(userIds: readonly string[]) => Promise<ReadonlyMap<string, RestrictionStanding>>>();
const dueClosings = vi.fn<(now: Date) => Promise<readonly { closing: StandingClose; userId: string }[]>>();
const requeueIf = vi.fn<(tx: unknown, userId: string, now: Date, carries: (profile: ProfessionalProfile) => boolean) => Promise<boolean>>();
const narrowLinksOf = vi.fn<(professionalId: string, now: Date, tx: unknown) => Promise<number>>();
const findById = vi.fn<(id: string) => Promise<User | undefined>>();
const findByUserId = vi.fn<(id: string) => Promise<Profile | undefined>>();
const isEnabled = vi.fn<(key: string, fallback: boolean) => Promise<boolean>>();
const badgeOf = vi.fn<(userId: string, now: Date) => Promise<Badge | null>>();
const badgesOf = vi.fn<(userIds: readonly string[], now: Date) => Promise<ReadonlyMap<string, Badge>>>();

const NOW = new Date('2026-11-19T09:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;
const NOTHING: RestrictionStanding = { closing: null, suspended: null };

/** A standing badge on `number`, checked by the owner — the only source a number is shown from (PRD 025 criterion 5). */
function badge(number: string | null): Badge {
  return {
    channel: 'register_email',
    checkedAt: new Date('2026-09-23T10:00:00.000Z'),
    checkId: '4a3b2c1d-0e9f-4a8b-9c7d-6e5f4a3b2c1d',
    dueAt: new Date('2027-09-23T10:00:00.000Z'),
    lapsesAt: new Date('2027-10-23T10:00:00.000Z'),
    number,
    register: 'Colegio de Madrid'
  };
}

const STATEMENT = JSON.stringify({ authority: null, clause: 2, facts: 'Se presenta como médico.', source: 'own_review' });

function suspended(at: Date = NOW): RestrictionStanding {
  return { closing: null, suspended: { actedAt: at, reason: STATEMENT } };
}

function closing(effectiveAt: Date, also: Partial<RestrictionStanding> = {}): RestrictionStanding {
  return { closing: { id: 'row-close', actedAt: NOW, actedBy: 'usr-owner', effectiveAt, reason: STATEMENT }, suspended: null, ...also };
}

vi.mock('#repositories/Professional', async () => {
  const actual = await vi.importActual<typeof Repositories>('#repositories/Professional');

  return {
    barsOpening: actual.barsOpening,
    blocksPractice: actual.blocksPractice,
    PracticeRestrictionRepository: {
      act: (userId: string, row: Row, decide: Decide, record?: Record) => act(userId, row, decide, record),
      dueClosings: (now: Date) => dueClosings(now),
      standing: (userId: string, db?: unknown) => standing(userId, db),
      standings: (userIds: readonly string[]) => standings(userIds)
    },
    ProfessionalBadgeRepository: {
      badgeOf: (userId: string, now: Date) => badgeOf(userId, now),
      badgesOf: (userIds: readonly string[], now: Date) => badgesOf(userIds, now)
    },
    ProfessionalProfileRepository: {
      requeueIf: (tx: unknown, userId: string, now: Date, carries: (profile: ProfessionalProfile) => boolean) => requeueIf(tx, userId, now, carries)
    },
    ProfessionalRepository: {
      acceptAgreement: (userId: string, version: string, now: Date) => acceptAgreement(userId, version, now),
      close: (userId: string, closingId: string, now: Date, withdrawal: { checkedBy: string | null; reason: string }, hooks: CloseHooks) =>
        close(userId, closingId, now, withdrawal, hooks),
      find: (userId: string) => find(userId),
      list: (query: ProfessionalQuery) => list(query),
      listWithoutPractice: (query: ProfessionalQuery) => listWithoutPractice(query),
      open: (userId: string, birth: { birthDate: string | null; locale: string | null }, now: Date, barred: (tx: unknown) => Promise<boolean>) =>
        open(userId, birth, now, barred)
    }
  };
});
vi.mock('#repositories/Care', () => ({
  CareRepository: {
    endLinksOf: (professionalId: string, now: Date, tx: unknown) => endLinksOf(professionalId, now, tx),
    narrowLinksOf: (professionalId: string, now: Date, tx: unknown) => narrowLinksOf(professionalId, now, tx)
  }
}));
vi.mock('#repositories/Audit', () => ({ AuditRepository: { record: (entry: unknown, tx?: unknown) => auditRecord(entry, tx) } }));
vi.mock('#repositories/Profile', () => ({ ProfileRepository: { findByUserId: (id: string) => findByUserId(id) } }));
vi.mock('#repositories/User', () => ({ UserRepository: { findById: (id: string) => findById(id) } }));
vi.mock('#repositories/Settings', () => ({ SettingsRepository: { isEnabled: (key: string, fallback: boolean) => isEnabled(key, fallback) } }));

beforeEach(() => {
  vi.clearAllMocks();
  acceptAgreement.mockReset();
  find.mockReset();
  list.mockReset();
  open.mockReset();
  close.mockReset();
  act.mockReset();
  standing.mockReset();
  standing.mockResolvedValue(NOTHING);
  standings.mockReset();
  standings.mockResolvedValue(new Map());
  listWithoutPractice.mockReset();
  listWithoutPractice.mockResolvedValue([]);
  auditRecord.mockReset();
  dueClosings.mockReset();
  requeueIf.mockReset();
  findById.mockReset();
  findByUserId.mockReset();
  isEnabled.mockReset();
  isEnabled.mockResolvedValue(true);
  badgeOf.mockReset();
  badgeOf.mockResolvedValue(null);
  badgesOf.mockReset();
  badgesOf.mockResolvedValue(new Map());
});

/*
 * PRD 025 scope 1, criteria 1, 2 and 24: the account opens its own practice.
 * Every refusal is one 404 and writes nothing.
 */
describe('ProfessionalController.open', () => {
  /** An adult, confirmed, opened account with a birth date on record. */
  function adult(): void {
    findById.mockResolvedValue(makeUser({ id: 'usr-pro' }));
    findByUserId.mockResolvedValue(makeProfile({ birthDate: '1990-04-02', userId: 'usr-pro' }));
    open.mockResolvedValue('opened');
  }

  it('opens the practice from the session’s account, writing no birth date when one is on record', async () => {
    adult();

    await expect(ProfessionalController.open('usr-pro', {}, 'en-GB', NOW)).resolves.toBeUndefined();

    expect(open).toHaveBeenCalledWith('usr-pro', { birthDate: null, locale: 'en-GB' }, NOW, expect.any(Function));
  });

  it('uses the body’s birth date only when none is on record, and writes it with the practice', async () => {
    adult();
    findByUserId.mockResolvedValue(makeProfile({ birthDate: null, userId: 'usr-pro' }));

    await ProfessionalController.open('usr-pro', { birthDate: '1990-04-02' }, null, NOW);

    expect(open).toHaveBeenCalledWith('usr-pro', { birthDate: '1990-04-02', locale: null }, NOW, expect.any(Function));
  });

  it('never lets the body move a birth date already on record: the one on record is judged', async () => {
    adult();
    findByUserId.mockResolvedValue(makeProfile({ birthDate: '2015-01-01', userId: 'usr-pro' }));

    await expect(ProfessionalController.open('usr-pro', { birthDate: '1980-01-01' }, null, NOW)).rejects.toThrow(NotFoundError);
    expect(open).not.toHaveBeenCalled();
  });

  it.each([
    ['the switch is off', () => isEnabled.mockResolvedValue(false)],
    ['the address is not confirmed', () => findById.mockResolvedValue(makeUser({ id: 'usr-pro', emailVerified: false }))],
    ['the owner has not opened the account', () => findById.mockResolvedValue(makeUser({ id: 'usr-pro', activatedAt: null }))],
    ['the account does not exist', () => findById.mockResolvedValue(undefined)],
    ['no birth date is on record and none is given', () => findByUserId.mockResolvedValue(makeProfile({ birthDate: null }))],
    ['the account never onboarded and gives none', () => findByUserId.mockResolvedValue(undefined)],
    ['the birth date is under 18', () => findByUserId.mockResolvedValue(makeProfile({ birthDate: '2010-06-01' }))]
  ])('is the same 404, and writes nothing, when %s', async (_label, arrange) => {
    adult();
    arrange();

    const refusal = await ProfessionalController.open('usr-pro', {}, null, NOW).catch((error: unknown) => error);

    expect(refusal).toBeInstanceOf(NotFoundError);
    expect((refusal as Error).message).toBe('Not Found');
    expect(open).not.toHaveBeenCalled();
  });

  it('is the same 404 for a birth date given under 18', async () => {
    adult();
    findByUserId.mockResolvedValue(undefined);

    await expect(ProfessionalController.open('usr-pro', { birthDate: '2012-01-01' }, null, NOW)).rejects.toThrow('Not Found');
    expect(open).not.toHaveBeenCalled();
  });

  it.each([
    ['suspended', suspended()],
    ['closing, its day not yet come', closing(new Date(NOW.getTime() + 10 * DAY))],
    ['closed', closing(new Date(NOW.getTime() - DAY))]
  ])('is the same 404 for an account %s: the restriction is asked inside the write, and bars it', async (_label, stands) => {
    adult();
    open.mockImplementation(async (_userId, _birth, _now, barred) => ((await barred('tx')) ? 'barred' : 'opened'));
    standing.mockResolvedValue(stands);

    await expect(ProfessionalController.open('usr-pro', {}, null, NOW)).rejects.toThrow('Not Found');
    // The one reader, on the write's own transaction.
    expect(standing).toHaveBeenCalledWith('usr-pro', 'tx');
  });

  it('answers an account that already practises as one just opened, writing nothing more', async () => {
    adult();
    open.mockResolvedValue('exists');

    await expect(ProfessionalController.open('usr-pro', {}, null, NOW)).resolves.toBeUndefined();
  });
});

describe('ProfessionalController.find', () => {
  it('presents the account’s own practice without the granter’s id, the number from the badge', async () => {
    find.mockResolvedValue(makeProfessional({ grantedBy: 'usr-owner', includedClients: 30, practiceOpen: true }));
    badgeOf.mockResolvedValue(badge('MAD00123'));

    const view = await ProfessionalController.find('usr-dietitian', NOW);

    expect(view).toEqual({
      agreementRequired: true,
      collegiateNumber: 'MAD00123',
      grantedAt: '2026-09-23T10:00:00.000Z',
      includedClients: 30,
      practiceOpen: true,
      restricted: false,
      restriction: null
    });
  });

  it('asks for the agreement until the current version is the one accepted', async () => {
    find.mockResolvedValueOnce(makeProfessional({ agreementAcceptedAt: new Date(), agreementVersion: '0.9.0' }));
    find.mockResolvedValueOnce(makeProfessional({ agreementAcceptedAt: new Date(), agreementVersion: PROFESSIONAL_AGREEMENT_VERSION }));

    await expect(ProfessionalController.find('usr-dietitian')).resolves.toMatchObject({ agreementRequired: true });
    await expect(ProfessionalController.find('usr-dietitian')).resolves.toMatchObject({ agreementRequired: false });
  });

  it('shows no number without a badge, whatever the practice row holds (PRD 025 criterion 5)', async () => {
    find.mockResolvedValue(makeProfessional({ collegiateNumber: 'UNCHECKED-1' }));

    await expect(ProfessionalController.find('usr-dietitian')).resolves.toMatchObject({ collegiateNumber: null });
  });

  it('answers null for an ordinary account, and reads nothing else', async () => {
    find.mockResolvedValue(null);

    await expect(ProfessionalController.find('usr-plain')).resolves.toBeNull();
    expect(standing).not.toHaveBeenCalled();
  });

  /* PRD 025 criterion 24: what every client route asks, read on every call. */
  it.each([
    ['nothing standing', NOTHING, false],
    ['a suspension', suspended(), true],
    ['a close not yet come: the practice works until its day', closing(new Date(NOW.getTime() + DAY)), false],
    ['a close whose day has come, before the sweep', closing(NOW), true]
  ])('is restricted with %s → %s', async (_label, stands, restricted) => {
    find.mockResolvedValue(makeProfessional());
    standing.mockResolvedValue(stands);

    await expect(ProfessionalController.find('usr-dietitian', NOW)).resolves.toMatchObject({ restricted });
  });

  it('carries the statement of what stands, never who decided it', async () => {
    find.mockResolvedValue(makeProfessional());
    standing.mockResolvedValue(closing(new Date(NOW.getTime() + 30 * DAY), { suspended: { actedAt: NOW, reason: STATEMENT } }));

    const view = await ProfessionalController.find('usr-dietitian', NOW);

    expect(view?.restriction).toEqual({
      closing: {
        closed: false,
        closesAt: '2026-12-19T09:00:00.000Z',
        decidedAt: NOW.toISOString(),
        statement: { authority: null, clause: 2, facts: 'Se presenta como médico.', source: 'own_review' }
      },
      suspended: { since: NOW.toISOString(), statement: { authority: null, clause: 2, facts: 'Se presenta como médico.', source: 'own_review' } }
    });
    expect(JSON.stringify(view)).not.toContain('usr-owner');
  });
});

describe('ProfessionalController.hasAccess', () => {
  it('is false while the switch is off, whatever the table says — and does not even look', async () => {
    isEnabled.mockResolvedValue(false);
    find.mockResolvedValue(makeProfessional());

    await expect(ProfessionalController.hasAccess('usr-dietitian')).resolves.toBe(false);
    expect(isEnabled).toHaveBeenCalledWith('professional', false);
    expect(find).not.toHaveBeenCalled();
  });

  it('is false for an account with no practice, even with the switch on', async () => {
    find.mockResolvedValue(null);

    await expect(ProfessionalController.hasAccess('usr-plain')).resolves.toBe(false);
  });

  it('is true for an account with a practice and the switch on — paid for or not', async () => {
    find.mockResolvedValue(makeProfessional({ practiceOpen: false }));

    await expect(ProfessionalController.hasAccess('usr-dietitian')).resolves.toBe(true);
    expect(find).toHaveBeenCalledWith('usr-dietitian');
  });

  it('is false on the very next question once the practice is closed — nothing is remembered', async () => {
    find.mockResolvedValueOnce(makeProfessional()).mockResolvedValueOnce(null);

    await expect(ProfessionalController.hasAccess('usr-dietitian')).resolves.toBe(true);
    await expect(ProfessionalController.hasAccess('usr-dietitian')).resolves.toBe(false);
    expect(find).toHaveBeenCalledTimes(2);
  });
});

describe('ProfessionalController.isOpen', () => {
  it('is the switch alone, failing off, and asks about no account', async () => {
    isEnabled.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    await expect(ProfessionalController.isOpen()).resolves.toBe(false);
    await expect(ProfessionalController.isOpen()).resolves.toBe(true);
    expect(isEnabled).toHaveBeenCalledWith('professional', false);
    expect(find).not.toHaveBeenCalled();
  });
});

describe('ProfessionalController.list', () => {
  it('names each practitioner’s account and counts their links, and nothing about a client', async () => {
    // Only `usr-a` holds a badge: `usr-b`'s typed number is never shown (PRD 025 criterion 5).
    badgesOf.mockResolvedValue(new Map([['usr-a', badge('MAD00123')]]));
    standings.mockResolvedValue(new Map([['usr-b', suspended()]]));
    list.mockResolvedValue([
      {
        collegiateNumber: 'CV-0456',
        email: 'b@example.com',
        grantedAt: new Date('2026-09-23T11:00:00.000Z'),
        includedClients: 0,
        links: { active: 0, ended: 0, paused: 0 },
        practiceOpen: false,
        userId: 'usr-b'
      },
      {
        collegiateNumber: 'MAD00123',
        email: 'a@example.com',
        grantedAt: new Date('2026-09-23T10:00:00.000Z'),
        includedClients: 30,
        links: { active: 12, ended: 3, paused: 1 },
        practiceOpen: true,
        userId: 'usr-a'
      }
    ]);

    const rows = await ProfessionalController.list(undefined, NOW);

    expect(badgesOf).toHaveBeenCalledWith(['usr-b', 'usr-a'], NOW);
    expect(standings).toHaveBeenCalledWith(['usr-b', 'usr-a']);
    expect(rows).toEqual([
      {
        collegiateNumber: null,
        email: 'b@example.com',
        grantedAt: '2026-09-23T11:00:00.000Z',
        links: { active: 0, ended: 0, paused: 0 },
        practising: true,
        restriction: {
          closing: null,
          suspended: { since: NOW.toISOString(), statement: { authority: null, clause: 2, facts: 'Se presenta como médico.', source: 'own_review' } }
        },
        userId: 'usr-b'
      },
      {
        collegiateNumber: 'MAD00123',
        email: 'a@example.com',
        grantedAt: '2026-09-23T10:00:00.000Z',
        links: { active: 12, ended: 3, paused: 1 },
        practising: true,
        restriction: null,
        userId: 'usr-a'
      }
    ]);
    // The keys are the whole contract of `0028` here: no client id, name or address may ever join them.
    expect(Object.keys(rows[0] ?? {}).sort()).toEqual(['collegiateNumber', 'email', 'grantedAt', 'links', 'practising', 'restriction', 'userId']);
    expect(Object.keys(rows[1]?.links ?? {}).sort()).toEqual(['active', 'ended', 'paused']);
  });

  /* Invariant review of phase 6, P2-5: a closed practice loses its row, and the owner must still find it to lift the close. */
  it('lists, after the practices, every account a restriction stands against with no practice — and none whose close was lifted', async () => {
    const closedPractice = (userId: string, email: string): ProfessionalListRow => ({
      collegiateNumber: null,
      email,
      grantedAt: null,
      includedClients: 0,
      links: { active: 0, ended: 4, paused: 0 },
      practiceOpen: false,
      userId
    });

    list.mockResolvedValue([]);
    listWithoutPractice.mockResolvedValue([closedPractice('usr-closed', 'closed@example.com'), closedPractice('usr-lifted', 'lifted@example.com')]);
    standings.mockResolvedValue(new Map([['usr-closed', closing(new Date(NOW.getTime() - DAY))]]));

    const rows = await ProfessionalController.list({ dir: 'desc', q: 'example', sort: 'grantedAt' }, NOW);

    expect(listWithoutPractice).toHaveBeenCalledWith({ dir: 'desc', q: 'example', sort: 'grantedAt' });
    expect(rows).toEqual([
      {
        collegiateNumber: null,
        email: 'closed@example.com',
        grantedAt: null,
        links: { active: 0, ended: 4, paused: 0 },
        practising: false,
        restriction: expect.objectContaining({ closing: expect.objectContaining({ closed: true }) as unknown }) as unknown,
        userId: 'usr-closed'
      }
    ]);
  });

  it('carries only the three counts, whatever else a row brings', async () => {
    const smuggled = { active: 1, clientIds: ['usr-client'], ended: 0, paused: 0 } as unknown as ProfessionalListRow['links'];

    list.mockResolvedValue([
      {
        collegiateNumber: 'MAD00123',
        email: 'a@example.com',
        grantedAt: new Date('2026-09-23T10:00:00.000Z'),
        includedClients: 30,
        links: smuggled,
        practiceOpen: true,
        userId: 'usr-a'
      }
    ]);

    const [row] = await ProfessionalController.list();

    expect(row?.links).toEqual({ active: 1, ended: 0, paused: 0 });
  });

  it('asks for the most recently opened first when nothing is asked, as the list always did', async () => {
    list.mockResolvedValue([]);

    await ProfessionalController.list();

    expect(list).toHaveBeenCalledWith({ dir: 'desc', q: undefined, sort: 'grantedAt' });
  });

  it('passes the search and the sort through to the query', async () => {
    list.mockResolvedValue([]);

    await ProfessionalController.list({ dir: 'asc', q: 'mad', sort: 'links' });

    expect(list).toHaveBeenCalledWith({ dir: 'asc', q: 'mad', sort: 'links' });
  });
});

describe('ProfessionalController.acceptAgreement', () => {
  it('writes the version for the session’s account and answers the practice, no longer asking', async () => {
    acceptAgreement.mockResolvedValue(makeProfessional({ agreementAcceptedAt: NOW, agreementVersion: PROFESSIONAL_AGREEMENT_VERSION }));

    const view = await ProfessionalController.acceptAgreement('usr-dietitian', { version: PROFESSIONAL_AGREEMENT_VERSION }, NOW);

    expect(acceptAgreement).toHaveBeenCalledWith('usr-dietitian', PROFESSIONAL_AGREEMENT_VERSION, NOW);
    expect(view.agreementRequired).toBe(false);
  });

  it('is a 404 for an account that is not a professional', async () => {
    acceptAgreement.mockResolvedValue(null);

    await expect(ProfessionalController.acceptAgreement('usr-plain', { version: PROFESSIONAL_AGREEMENT_VERSION }, NOW)).rejects.toThrow(
      NotFoundError
    );
  });

  it('is a 404 while the switch is off, and writes nothing', async () => {
    isEnabled.mockResolvedValue(false);

    await expect(ProfessionalController.acceptAgreement('usr-dietitian', { version: PROFESSIONAL_AGREEMENT_VERSION }, NOW)).rejects.toThrow(
      NotFoundError
    );
    expect(acceptAgreement).not.toHaveBeenCalled();
  });
});

/* PRD 025 scope 16: the owner's three acts, each one row and one decision on what stands. */
describe('ProfessionalController.suspend, close and lift', () => {
  const STATEMENT_INPUT = { clause: 2, facts: 'Se presenta como médico.', source: 'own_review' as const };

  beforeEach(() => {
    findById.mockResolvedValue(makeUser({ id: 'usr-pro', email: 'pro@example.com' }));
  });

  const TX = { name: 'the act’s transaction' };

  /** Runs the act's decision on `before`, writes its audit row, and answers as the repository would. */
  function deciding(before: RestrictionStanding, practising: boolean, after: RestrictionStanding): void {
    act.mockImplementation(async (_userId, _row, decide, record) => {
      if (!decide(before, practising)) {
        return null;
      }

      const done = { after, before, practising };

      await record?.(TX, done);

      return done;
    });
  }

  it('suspends a practice at once, with the statement stored as it will be read back, and its audit row', async () => {
    deciding(NOTHING, true, suspended());

    const done = await ProfessionalController.suspend('usr-pro', 'usr-owner', STATEMENT_INPUT, NOW);

    expect(act).toHaveBeenCalledWith(
      'usr-pro',
      { actedBy: 'usr-owner', effectiveAt: null, kind: 'suspended', reason: STATEMENT },
      expect.any(Function),
      expect.any(Function)
    );
    expect(done).toMatchObject({ closesAt: null, kind: 'suspended', suspended: true, to: 'pro@example.com', userId: 'usr-pro', wasSuspended: false });
    expect(done.answer.restriction?.suspended?.since).toBe(NOW.toISOString());
    // ADR `0071`: the owner's act, in its own transaction — the source, never the facts.
    expect(auditRecord).toHaveBeenCalledExactlyOnceWith(
      {
        action: 'professional.suspended',
        actorId: 'usr-owner',
        entity: 'professional',
        metadata: { source: 'own_review' },
        subjectUserId: 'usr-pro'
      },
      TX
    );
  });

  it.each([
    ['an account with no practice', NOTHING, false],
    ['an account already suspended', suspended(), true]
  ])('refuses to suspend %s with the 404, writing nothing', async (_label, before, practising) => {
    deciding(before, practising, before);

    await expect(ProfessionalController.suspend('usr-pro', 'usr-owner', STATEMENT_INPUT, NOW)).rejects.toThrow('Not Found');
    expect(auditRecord).not.toHaveBeenCalled();
  });

  it('closes thirty days on — never sooner — and a suspended practice stays suspended', async () => {
    const closesAt = new Date(NOW.getTime() + 30 * DAY);

    deciding(suspended(), true, closing(closesAt, { suspended: { actedAt: NOW, reason: STATEMENT } }));

    const done = await ProfessionalController.close('usr-pro', 'usr-owner', STATEMENT_INPUT, NOW);

    expect(act).toHaveBeenCalledWith(
      'usr-pro',
      { actedBy: 'usr-owner', effectiveAt: closesAt, kind: 'closing', reason: STATEMENT },
      expect.any(Function),
      expect.any(Function)
    );
    expect(done).toMatchObject({ closesAt, kind: 'closing', suspended: true, withdrawnClose: null });
    expect(auditRecord).toHaveBeenCalledWith(expect.objectContaining({ action: 'professional.closing', metadata: { source: 'own_review' } }), TX);
  });

  it.each([
    ['an account with no practice', NOTHING, false],
    ['a practice already closing', closing(new Date(NOW.getTime() + DAY)), true]
  ])('refuses to close %s with the 404', async (_label, before, practising) => {
    deciding(before, practising, before);

    await expect(ProfessionalController.close('usr-pro', 'usr-owner', STATEMENT_INPUT, NOW)).rejects.toThrow('Not Found');
  });

  it('lifts a suspension — practice or not — and says it was one', async () => {
    deciding(suspended(), false, NOTHING);

    const done = await ProfessionalController.lift('usr-pro', 'usr-owner', { facts: 'los hechos no se confirmaron' }, NOW);

    expect(act).toHaveBeenCalledWith(
      'usr-pro',
      { actedBy: 'usr-owner', effectiveAt: null, kind: 'lifted', reason: 'los hechos no se confirmaron' },
      expect.any(Function),
      expect.any(Function)
    );
    expect(done).toMatchObject({ answer: { restriction: null, userId: 'usr-pro' }, kind: 'lifted', wasSuspended: true, withdrawnClose: null });
    expect(auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'professional.restriction_lifted', metadata: { close: false, suspension: true } }),
      TX
    );
  });

  /* `textos/06` § W bis.4: which close mail goes — before the close was carried out, or after (the practice gone). */
  it.each([
    ['not yet carried out: the practice still there', true, false],
    ['already carried out: no practice left', false, true]
  ])('lifts a close %s, and says so', async (_label, practising, carriedOut) => {
    const closesAt = new Date(NOW.getTime() - DAY);

    deciding(closing(closesAt), practising, NOTHING);

    await expect(ProfessionalController.lift('usr-pro', 'usr-owner', {}, NOW)).resolves.toMatchObject({
      wasSuspended: false,
      withdrawnClose: { carriedOut, closesAt }
    });
    expect(auditRecord).toHaveBeenCalledWith(expect.objectContaining({ metadata: { close: true, suspension: false } }), TX);
  });

  it('refuses to lift what does not stand', async () => {
    deciding(NOTHING, true, NOTHING);

    await expect(ProfessionalController.lift('usr-pro', 'usr-owner', {}, NOW)).rejects.toThrow('Not Found');
  });

  it('is a 404 for an account that does not exist, before anything is written', async () => {
    findById.mockResolvedValue(undefined);

    await expect(ProfessionalController.suspend('usr-nobody', 'usr-owner', STATEMENT_INPUT, NOW)).rejects.toThrow(NotFoundError);
    expect(act).not.toHaveBeenCalled();
  });
});

/* PLAN 025 phase 6 steps 0 and 7: the close carried out on its day, as the 004 revoke deleted the practice. */
describe('ProfessionalController.closeDue', () => {
  const due = (userId: string, reason: string | null = STATEMENT): { closing: StandingClose; userId: string } => ({
    closing: { id: `close-${userId}`, actedAt: NOW, actedBy: 'usr-owner', effectiveAt: NOW, reason },
    userId
  });

  it('closes each practice whose day came, withdrawing its badge with the close’s facts', async () => {
    dueClosings.mockResolvedValue([due('usr-a'), due('usr-b', null)]);
    close.mockResolvedValue(true);

    await expect(ProfessionalController.closeDue(NOW)).resolves.toEqual({ closed: ['usr-a', 'usr-b'], failed: [] });

    // The close the list found — read again by the repository under the lock (invariant review of phase 6, P1-3).
    expect(close).toHaveBeenCalledWith(
      'usr-a',
      'close-usr-a',
      NOW,
      { checkedBy: 'usr-owner', reason: 'other: Se presenta como médico.' },
      expect.any(Object)
    );
    expect(close).toHaveBeenCalledWith('usr-b', 'close-usr-b', NOW, { checkedBy: 'usr-owner', reason: 'other' }, expect.any(Object));
  });

  /*
   * The lead, on the phase 6 review: a close **ends** the practitioner's open links, as
   * the practitioner ending them — a link left open to a practice closed for good would
   * keep its client from accepting anybody else. Nothing is narrowed: no link is left.
   */
  it('hands the close the ending of that practitioner’s links and the profile’s requeue — no narrowing — for its own transaction', async () => {
    const TX = { name: 'the close’s transaction' };

    dueClosings.mockResolvedValue([due('usr-a')]);
    close.mockImplementation(async (_userId, _closingId, _now, _withdrawal, hooks) => {
      await hooks.endLinks(TX);
      await hooks.whenWithdrawn?.(TX);
      await hooks.record?.(TX as never);

      return true;
    });

    await ProfessionalController.closeDue(NOW);

    expect(endLinksOf).toHaveBeenCalledExactlyOnceWith('usr-a', NOW, TX);
    expect(requeueIf).toHaveBeenCalledExactlyOnceWith(TX, 'usr-a', NOW, expect.any(Function));
    expect(narrowLinksOf).not.toHaveBeenCalled();
    // No actor: the cron, not a person (as `auth.unconfirmed_account_swept`).
    expect(auditRecord).toHaveBeenCalledExactlyOnceWith(
      { action: 'professional.closed', actorId: null, entity: 'professional', metadata: {}, subjectUserId: 'usr-a' },
      TX
    );
  });

  it('a close lifted since the list is not carried out, and is neither closed nor failed', async () => {
    dueClosings.mockResolvedValue([due('usr-a')]);
    close.mockResolvedValue(false);

    await expect(ProfessionalController.closeDue(NOW)).resolves.toEqual({ closed: [], failed: [] });
  });

  it('goes on past a practice that fails, and names it for the log', async () => {
    dueClosings.mockResolvedValue([due('usr-a'), due('usr-b')]);
    close.mockRejectedValueOnce(new Error('deadlock')).mockResolvedValueOnce(true);

    await expect(ProfessionalController.closeDue(NOW)).resolves.toEqual({ closed: ['usr-b'], failed: ['usr-a'] });
  });
});
