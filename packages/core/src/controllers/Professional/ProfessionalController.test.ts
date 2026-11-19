import { beforeEach, describe, expect, it, vi } from 'vitest';

import { makeProfessional, makeUser } from '#test/fixtures';
import { NotFoundError } from 'core/entities/Error';
import { PROFESSIONAL_AGREEMENT_VERSION } from 'core/entities/Professional';
import { UNAUDITED } from 'core/entities/Audit';

import { ProfessionalController } from './ProfessionalController';

import type { Badge, ProfessionalListRow } from '#repositories/Professional';
import type { Professional } from 'core/entities/Professional';
import type { ProfessionalQuery } from 'core/entities/AdminQuery';
import type { User } from 'core/entities/User';

const acceptAgreement = vi.fn<(userId: string, version: string, now: Date) => Promise<Professional | null>>();
const find = vi.fn<(userId: string) => Promise<Professional | null>>();
const grant =
  vi.fn<
    (
      userId: string,
      collegiateNumber: string,
      grantedBy: string,
      record?: (tx: unknown) => Promise<void>,
      beforeRegained?: (tx: unknown) => Promise<unknown>
    ) => Promise<Professional>
  >();
const narrowLinksOf = vi.fn<(professionalId: string, now: Date, tx: unknown) => Promise<number>>();
const list = vi.fn<(query: ProfessionalQuery) => Promise<readonly ProfessionalListRow[]>>();
const linkCounts = vi.fn<(professionalId: string) => Promise<ProfessionalListRow['links']>>();
const revoke = vi.fn<(userId: string, record?: (tx: unknown) => Promise<void>) => Promise<boolean>>();
const findById = vi.fn<(id: string) => Promise<User | undefined>>();
const isEnabled = vi.fn<(key: string, fallback: boolean) => Promise<boolean>>();
const record = vi.fn<(entry: unknown, tx?: unknown) => Promise<void>>();
const badgeOf = vi.fn<(userId: string, now: Date) => Promise<Badge | null>>();
const badgesOf = vi.fn<(userIds: readonly string[], now: Date) => Promise<ReadonlyMap<string, Badge>>>();

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

vi.mock('#repositories/Professional', () => ({
  ProfessionalBadgeRepository: {
    badgeOf: (userId: string, now: Date) => badgeOf(userId, now),
    badgesOf: (userIds: readonly string[], now: Date) => badgesOf(userIds, now)
  },
  ProfessionalRepository: {
    acceptAgreement: (userId: string, version: string, now: Date) => acceptAgreement(userId, version, now),
    find: (userId: string) => find(userId),
    grant: (
      userId: string,
      collegiateNumber: string,
      grantedBy: string,
      r?: (tx: unknown) => Promise<void>,
      beforeRegained?: (tx: unknown) => Promise<unknown>
    ) => grant(userId, collegiateNumber, grantedBy, r, beforeRegained),
    linkCounts: (professionalId: string) => linkCounts(professionalId),
    list: (query: ProfessionalQuery) => list(query),
    revoke: (userId: string, r?: (tx: unknown) => Promise<void>) => revoke(userId, r)
  }
}));
vi.mock('#repositories/Care', () => ({
  CareRepository: { narrowLinksOf: (professionalId: string, now: Date, tx: unknown) => narrowLinksOf(professionalId, now, tx) }
}));
vi.mock('#repositories/User', () => ({ UserRepository: { findById: (id: string) => findById(id) } }));
vi.mock('#repositories/Settings', () => ({ SettingsRepository: { isEnabled: (key: string, fallback: boolean) => isEnabled(key, fallback) } }));
vi.mock('#repositories/Audit', () => ({ AuditRepository: { record: (entry: unknown, tx?: unknown) => record(entry, tx) } }));

beforeEach(() => {
  acceptAgreement.mockReset();
  find.mockReset();
  grant.mockReset();
  list.mockReset();
  linkCounts.mockReset();
  linkCounts.mockResolvedValue({ active: 0, ended: 0, paused: 0 });
  revoke.mockReset();
  findById.mockReset();
  isEnabled.mockReset();
  badgeOf.mockReset();
  badgeOf.mockResolvedValue(null);
  badgesOf.mockReset();
  badgesOf.mockResolvedValue(new Map());
});

describe('ProfessionalController.grant', () => {
  it('records the owner’s act on an existing account and answers the account, never the granter', async () => {
    findById.mockResolvedValue(makeUser({ id: 'usr-dietitian', email: 'dietista@example.com' }));
    grant.mockResolvedValue(makeProfessional({ grantedBy: 'usr-owner', userId: 'usr-dietitian' }));
    // The grant writes its own `pass` (PLAN phase 3, step 7): the number shown is that check's.
    badgeOf.mockResolvedValue(badge('MAD00123'));

    const view = await ProfessionalController.grant('usr-dietitian', { collegiateNumber: 'MAD00123' }, 'usr-owner');

    expect(grant).toHaveBeenCalledWith('usr-dietitian', 'MAD00123', 'usr-owner', expect.any(Function), expect.any(Function));
    expect(view).toEqual({
      collegiateNumber: 'MAD00123',
      email: 'dietista@example.com',
      grantedAt: '2026-09-23T10:00:00.000Z',
      links: { active: 0, ended: 0, paused: 0 },
      userId: 'usr-dietitian'
    });
    expect(view).not.toHaveProperty('grantedBy');
  });

  /* Project 025 phase 5, review round two (P2-A): a grant that brings a badge back narrows that practitioner's links first. */
  it('hands the grant a narrowing of that practitioner’s links, for its own transaction', async () => {
    const TX = { name: 'the grant’s transaction' };

    findById.mockResolvedValue(makeUser({ id: 'usr-dietitian', email: 'dietista@example.com' }));
    grant.mockImplementation(async (_userId, _number, _by, _record, beforeRegained) => {
      await beforeRegained?.(TX);

      return makeProfessional({ grantedBy: 'usr-owner', userId: 'usr-dietitian' });
    });
    narrowLinksOf.mockResolvedValue(1);

    await ProfessionalController.grant('usr-dietitian', { collegiateNumber: 'MAD00123' }, 'usr-owner');

    expect(narrowLinksOf).toHaveBeenCalledExactlyOnceWith('usr-dietitian', expect.any(Date), TX);
  });

  it('is a 404 for an account that does not exist, and writes nothing', async () => {
    findById.mockResolvedValue(undefined);

    await expect(ProfessionalController.grant('usr-nobody', { collegiateNumber: 'MAD00123' }, 'usr-owner')).rejects.toThrow(NotFoundError);
    expect(grant).not.toHaveBeenCalled();
  });

  it('is a 404 for an account whose address is unconfirmed, and writes nothing', async () => {
    findById.mockResolvedValue(makeUser({ id: 'usr-dietitian', emailVerified: false }));

    await expect(ProfessionalController.grant('usr-dietitian', { collegiateNumber: 'MAD00123' }, 'usr-owner')).rejects.toThrow(NotFoundError);
    expect(grant).not.toHaveBeenCalled();
  });

  it('writes no trail row when a probe grants with UNAUDITED, though the stored grantedBy still names it', async () => {
    findById.mockResolvedValue(makeUser({ id: 'usr-dietitian', email: 'dietista@example.com' }));
    grant.mockResolvedValue(makeProfessional({ grantedBy: 'usr-dietitian', userId: 'usr-dietitian' }));

    await ProfessionalController.grant('usr-dietitian', { collegiateNumber: 'PROBE-001' }, 'usr-dietitian', UNAUDITED);

    expect(grant).toHaveBeenCalledWith('usr-dietitian', 'PROBE-001', 'usr-dietitian', undefined, expect.any(Function));
  });
});

describe('ProfessionalController.revoke', () => {
  it('takes the grant back, with the owner as the trail’s actor', async () => {
    revoke.mockResolvedValue(true);

    await expect(ProfessionalController.revoke('usr-dietitian', 'usr-owner')).resolves.toBeUndefined();
    expect(revoke).toHaveBeenCalledWith('usr-dietitian', expect.any(Function));
  });

  it('is a 404 when the account was never a professional', async () => {
    revoke.mockResolvedValue(false);

    await expect(ProfessionalController.revoke('usr-dietitian', 'usr-owner')).rejects.toThrow(NotFoundError);
  });
});

describe('ProfessionalController.find', () => {
  it('presents the professional’s own grant without the granter’s id, the number from the badge', async () => {
    find.mockResolvedValue(makeProfessional({ grantedBy: 'usr-owner', includedClients: 30, practiceOpen: true }));
    badgeOf.mockResolvedValue(badge('MAD00123'));

    const view = await ProfessionalController.find('usr-dietitian');

    expect(view).toEqual({
      agreementRequired: true,
      collegiateNumber: 'MAD00123',
      grantedAt: '2026-09-23T10:00:00.000Z',
      includedClients: 30,
      practiceOpen: true
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

  it('answers null for an ordinary account', async () => {
    find.mockResolvedValue(null);

    await expect(ProfessionalController.find('usr-plain')).resolves.toBeNull();
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

  it('is false for an account the owner never granted, even with the switch on', async () => {
    isEnabled.mockResolvedValue(true);
    find.mockResolvedValue(null);

    await expect(ProfessionalController.hasAccess('usr-plain')).resolves.toBe(false);
  });

  it('is true only for a granted account with the switch on', async () => {
    isEnabled.mockResolvedValue(true);
    find.mockResolvedValue(makeProfessional());

    await expect(ProfessionalController.hasAccess('usr-dietitian')).resolves.toBe(true);
    expect(find).toHaveBeenCalledWith('usr-dietitian');
  });

  it('is false on the very next question once the grant is revoked — nothing is remembered', async () => {
    isEnabled.mockResolvedValue(true);
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
  it('names each professional’s account and counts their links, and nothing about a client', async () => {
    // Only `usr-a` holds a badge: `usr-b`'s typed number is never shown (PRD 025 criterion 5).
    badgesOf.mockResolvedValue(new Map([['usr-a', badge('MAD00123')]]));
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

    const rows = await ProfessionalController.list();

    expect(badgesOf).toHaveBeenCalledWith(['usr-b', 'usr-a'], expect.any(Date));
    expect(rows).toEqual([
      {
        collegiateNumber: null,
        email: 'b@example.com',
        grantedAt: '2026-09-23T11:00:00.000Z',
        links: { active: 0, ended: 0, paused: 0 },
        userId: 'usr-b'
      },
      {
        collegiateNumber: 'MAD00123',
        email: 'a@example.com',
        grantedAt: '2026-09-23T10:00:00.000Z',
        links: { active: 12, ended: 3, paused: 1 },
        userId: 'usr-a'
      }
    ]);
    // The keys are the whole contract of `0028` here: no client id, name or address may ever join them.
    expect(Object.keys(rows[0] ?? {}).sort()).toEqual(['collegiateNumber', 'email', 'grantedAt', 'links', 'userId']);
    expect(Object.keys(rows[1]?.links ?? {}).sort()).toEqual(['active', 'ended', 'paused']);
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

  it('asks for the most recently granted first when nothing is asked, as the list always did', async () => {
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
  const NOW = new Date('2026-09-25T09:00:00.000Z');

  it('writes the version for the session’s account and answers the grant, no longer asking', async () => {
    isEnabled.mockResolvedValue(true);
    acceptAgreement.mockResolvedValue(makeProfessional({ agreementAcceptedAt: NOW, agreementVersion: PROFESSIONAL_AGREEMENT_VERSION }));

    const view = await ProfessionalController.acceptAgreement('usr-dietitian', { version: PROFESSIONAL_AGREEMENT_VERSION }, NOW);

    expect(acceptAgreement).toHaveBeenCalledWith('usr-dietitian', PROFESSIONAL_AGREEMENT_VERSION, NOW);
    expect(view.agreementRequired).toBe(false);
  });

  it('is a 404 for an account that is not a professional', async () => {
    isEnabled.mockResolvedValue(true);
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
