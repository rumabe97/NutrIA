import { createHash } from 'node:crypto';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { makeProfessional, makeUser } from '#test/fixtures';
import { CARE_CONSENT_VERSION, CARE_HEALTH_SHARED, CARE_SHARED, CARE_SHARED_PLAN, CARE_TOKEN_PATTERN } from 'core/entities/Care';
import { CareIllnessRuleError, CareLinkExistsError, InputParseError, NotFoundError, PracticeFullError } from 'core/entities/Error';
import { PROFESSIONAL_AGREEMENT_VERSION } from 'core/entities/Professional';

import { CareController } from './CareController';
import { PlanController } from 'core/controllers/Plan';

import type {
  AcceptOutcome,
  EndedByRule,
  InviteOutcome,
  linkScope as linkScopeFn,
  LinkWithProfessional,
  OpenInvitation,
  PracticeUse,
  RuleEnding
} from '#repositories/Care';
import type { AcceptInvitation, CareLink } from 'core/entities/Care';
import type { Allowances } from 'core/domain/Allowance';
import type { blocksPractice as blocksPracticeFn, RestrictionStanding } from '#repositories/Professional';
import type { Professional } from 'core/entities/Professional';
import type { User } from 'core/entities/User';

const accept = vi.fn<(clientId: string, email: string, tokenHash: string, answer: AcceptInvitation, now: Date) => Promise<AcceptOutcome>>();
const clientLink = vi.fn<(clientId: string) => Promise<LinkWithProfessional | null>>();
const decline = vi.fn<(clientId: string, email: string, tokenHash: string, now: Date) => Promise<boolean>>();
const end = vi.fn<(userId: string, side: 'client' | 'professional', linkId: string, now: Date) => Promise<boolean>>();
const forgetAddress = vi.fn<(email: string) => Promise<void>>();
const invite =
  vi.fn<
    (professionalId: string, email: string, tokenHash: string, expiresAt: Date, now: Date, freeSeats: () => Promise<number>) => Promise<InviteOutcome>
  >();
const standing = vi.fn<(userId: string) => Promise<RestrictionStanding>>();
const setSharesHealth = vi.fn<(clientId: string, sharesHealth: boolean, now: Date) => Promise<LinkWithProfessional | null>>();
const forgetExpired = vi.fn<(now: Date) => Promise<number>>();
const practiceUse = vi.fn<(professionalId: string, now: Date) => Promise<PracticeUse>>();
const openInvitation = vi.fn<(clientId: string, email: string, tokenHash: string, now: Date) => Promise<OpenInvitation | null>>();
const find = vi.fn<(userId: string) => Promise<Professional | null>>();
const isEnabled = vi.fn<(key: string, fallback: boolean) => Promise<boolean>>();
const findUserById = vi.fn<(id: string) => Promise<User | undefined>>();
const badgeOf = vi.fn<(userId: string, now: Date) => Promise<object | null>>();
const reconsent = vi.fn<(clientId: string, consentVersion: string, now: Date) => Promise<LinkWithProfessional | null>>();
const lastEndedByRule = vi.fn<(clientId: string) => Promise<EndedByRule | null>>();
const sweepBadgeLoss = vi.fn<(now: Date) => Promise<{ readonly ended: readonly RuleEnding[]; readonly narrowed: number }>>();

vi.mock('#repositories/User', () => ({ UserRepository: { findById: (id: string) => findUserById(id) } }));
vi.mock('#repositories/Care', async () => ({
  CareRepository: {
    accept: (...args: Parameters<typeof accept>) => accept(...args),
    clientLink: (clientId: string) => clientLink(clientId),
    decline: (...args: Parameters<typeof decline>) => decline(...args),
    end: (...args: Parameters<typeof end>) => end(...args),
    forgetAddress: (email: string) => forgetAddress(email),
    forgetExpired: (now: Date) => forgetExpired(now),
    invite: (...args: Parameters<typeof invite>) => invite(...args),
    lastEndedByRule: (clientId: string) => lastEndedByRule(clientId),
    openInvitation: (...args: Parameters<typeof openInvitation>) => openInvitation(...args),
    practiceUse: (...args: Parameters<typeof practiceUse>) => practiceUse(...args),
    reconsent: (...args: Parameters<typeof reconsent>) => reconsent(...args),
    setSharesHealth: (...args: Parameters<typeof setSharesHealth>) => setSharesHealth(...args),
    sweepBadgeLoss: (now: Date) => sweepBadgeLoss(now)
  },
  // The real rule, not a stub: which scope a link opens is what these cases are about.
  linkScope: (await vi.importActual<{ linkScope: typeof linkScopeFn }>('../../repositories/Care/CareScope')).linkScope
}));
vi.mock('#repositories/Professional', async () => ({
  // The real rule (project 025 phase 6): what a restriction refuses is decided in one place.
  blocksPractice: (
    await vi.importActual<{ blocksPractice: typeof blocksPracticeFn }>('../../repositories/Professional/PracticeRestrictionRepository')
  ).blocksPractice,
  PracticeRestrictionRepository: { standing: (userId: string) => standing(userId) },
  ProfessionalBadgeRepository: { badgeOf: (userId: string, now: Date) => badgeOf(userId, now) },
  ProfessionalRepository: { find: (userId: string) => find(userId) }
}));
vi.mock('#repositories/Settings', () => ({ SettingsRepository: { isEnabled: (key: string, fallback: boolean) => isEnabled(key, fallback) } }));

const NOW = new Date('2026-09-23T10:00:00.000Z');
const TOKEN = 'A'.repeat(43);
const TOKEN_HASH = createHash('sha256').update(TOKEN).digest('hex');
const CLIENT = { id: 'usr-client', email: 'Cliente@Example.com', emailVerified: true };
const PRO = { id: 'usr-pro', email: 'dietista@example.com' };

function makeLink(overrides?: Partial<CareLink>): CareLink {
  return {
    id: '0b8e7f4a-3c2d-4e1f-9a8b-7c6d5e4f3a2b',
    clientId: CLIENT.id,
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

beforeEach(() => {
  for (const mock of [
    accept,
    clientLink,
    decline,
    end,
    forgetAddress,
    invite,
    openInvitation,
    practiceUse,
    setSharesHealth,
    find,
    isEnabled,
    findUserById,
    badgeOf,
    reconsent,
    lastEndedByRule,
    sweepBadgeLoss
  ]) {
    mock.mockReset();
  }

  isEnabled.mockResolvedValue(true);
  // Badged unless a case says otherwise: every existing practitioner stands as one (project 025, phase 2's backfill).
  badgeOf.mockResolvedValue({ number: '28-1234' });
  standing.mockReset();
  standing.mockResolvedValue({ closing: null, suspended: null });
  // The free practice's seats as the console would resolve them (`0097`): ten, unless a case moves them.
  vi.spyOn(PlanController, 'limitsOf')
    .mockClear()
    .mockResolvedValue({ practiceClients: 10 } as Allowances);
});

describe('CareController.invite', () => {
  it('stores only the hash of a fresh token, lowercased address, fourteen days out — and hands the token back for the mail alone', async () => {
    invite.mockImplementation(async (professionalId, email, tokenHash, expiresAt) => ({
      invitation: { id: '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f', createdAt: NOW, email, expiresAt, professionalId, tokenHash, updatedAt: NOW },
      kind: 'invited'
    }));

    const { invitation, token } = await CareController.invite(PRO, { email: '  Nueva@Example.COM ' }, NOW);

    expect(token).toMatch(CARE_TOKEN_PATTERN);
    const [professionalId, email, tokenHash, expiresAt] = invite.mock.calls[0] ?? [];

    expect(professionalId).toBe(PRO.id);
    expect(email).toBe('nueva@example.com');
    expect(tokenHash).toBe(createHash('sha256').update(token).digest('hex'));
    expect(tokenHash).not.toContain(token);
    expect(expiresAt).toEqual(new Date('2026-10-07T10:00:00.000Z'));
    // The route's whole answer: nothing about the address's account, and never the token.
    expect(invitation).toEqual({ email: 'nueva@example.com', expiresAt: '2026-10-07T10:00:00.000Z' });
  });

  it('makes a different token every time', async () => {
    invite.mockImplementation(async (professionalId, email, tokenHash, expiresAt) => ({
      invitation: { id: '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f', createdAt: NOW, email, expiresAt, professionalId, tokenHash, updatedAt: NOW },
      kind: 'invited'
    }));

    const first = await CareController.invite(PRO, { email: 'a@example.com' }, NOW);
    const second = await CareController.invite(PRO, { email: 'a@example.com' }, NOW);

    expect(first.token).not.toBe(second.token);
  });

  /* `0061`, PRD 004 criterion 17: the refusal names the number, which the repository counted under the practice's lock. */
  it('refuses one client more than the practice includes, naming the number', async () => {
    invite.mockResolvedValue({ includedClients: 30, kind: 'full' });

    await expect(CareController.invite(PRO, { email: 'n31@example.com' }, NOW)).rejects.toEqual(new PracticeFullError(30));
    await expect(CareController.invite(PRO, { email: 'n31@example.com' }, NOW)).rejects.toMatchObject({ includedClients: 30 });
  });

  /* PRD 025 criterion 7, `0111` § 6: a free practice's seats are the practitioner's `practiceClients`, resolved when the repository asks. */
  it('hands the repository the free seats, resolved for the practitioner’s own account, to ask inside its transaction', async () => {
    const limitsOf = vi.spyOn(PlanController, 'limitsOf').mockResolvedValue({ practiceClients: 4 } as Allowances);

    invite.mockImplementation(async (_professionalId, _email, _hash, _expiresAt, _now, freeSeats) => ({
      includedClients: await freeSeats(),
      kind: 'full'
    }));

    await expect(CareController.invite(PRO, { email: 'n11@example.com' }, NOW)).rejects.toEqual(new PracticeFullError(4));
    expect(limitsOf).toHaveBeenCalledWith(PRO.id);
  });

  it('asks nothing of the allowances when the repository does not need them — a paid practice', async () => {
    const limitsOf = vi.spyOn(PlanController, 'limitsOf');

    invite.mockResolvedValue({ includedClients: 30, kind: 'full' });

    await expect(CareController.invite(PRO, { email: 'n31@example.com' }, NOW)).rejects.toBeInstanceOf(PracticeFullError);
    expect(limitsOf).not.toHaveBeenCalled();
  });

  it('is a 404 when the practice is closed to clients — suspended, closed, or the agreement not accepted', async () => {
    invite.mockResolvedValue({ kind: 'closed' });

    await expect(CareController.invite(PRO, { email: 'nueva@example.com' }, NOW)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('refuses the professional’s own address, whatever its case, and writes nothing', async () => {
    await expect(CareController.invite(PRO, { email: 'DIETISTA@example.com' }, NOW)).rejects.toThrow(InputParseError);
    expect(invite).not.toHaveBeenCalled();
  });
});

describe('CareController.practice', () => {
  it('says whether a plan is paid for, the free seats in force and the seats in use — counts only', async () => {
    find.mockResolvedValue(makeProfessional({ includedClients: 0, practiceOpen: false }));
    practiceUse.mockResolvedValue({ activeClients: 0, pendingInvitations: 2 });

    await expect(CareController.practice(PRO, NOW)).resolves.toEqual({
      activeClients: 0,
      agreementAcceptedAt: null,
      agreementRequired: true,
      agreementVersion: PROFESSIONAL_AGREEMENT_VERSION,
      includedClients: 0,
      open: false,
      pendingInvitations: 2,
      restriction: null,
      // PRD 025 criterion 7: the free practice's ten, resolved as `invite` resolves them.
      seats: 10
    });
    expect(find).toHaveBeenCalledWith(PRO.id);
    expect(practiceUse).toHaveBeenCalledWith(PRO.id, NOW);
    expect(PlanController.limitsOf).toHaveBeenCalledWith(PRO.id);
  });

  it('a paid practice’s seats are its plan’s, and the allowances are not asked', async () => {
    find.mockResolvedValue(makeProfessional({ includedClients: 30, practiceOpen: true }));
    practiceUse.mockResolvedValue({ activeClients: 3, pendingInvitations: 0 });

    await expect(CareController.practice(PRO, NOW)).resolves.toMatchObject({ includedClients: 30, open: true, seats: 30 });
    expect(PlanController.limitsOf).not.toHaveBeenCalled();
  });

  it('carries what the owner has standing against the practice, so its own page can say it', async () => {
    find.mockResolvedValue(makeProfessional());
    practiceUse.mockResolvedValue({ activeClients: 0, pendingInvitations: 0 });
    standing.mockResolvedValue({ closing: null, suspended: { actedAt: NOW, reason: null } });

    await expect(CareController.practice(PRO, NOW)).resolves.toMatchObject({
      restriction: { closing: null, suspended: { since: NOW.toISOString(), statement: null } }
    });
  });

  it.each([
    [null, true],
    ['0.9.0', true],
    [PROFESSIONAL_AGREEMENT_VERSION, false]
  ])('asks for the agreement while the version accepted is %s', async (agreementVersion, agreementRequired) => {
    find.mockResolvedValue(makeProfessional({ agreementAcceptedAt: agreementVersion ? NOW : null, agreementVersion, practiceOpen: true }));
    practiceUse.mockResolvedValue({ activeClients: 0, pendingInvitations: 0 });

    await expect(CareController.practice(PRO, NOW)).resolves.toMatchObject({
      agreementAcceptedAt: agreementVersion ? NOW.toISOString() : null,
      agreementRequired,
      agreementVersion: PROFESSIONAL_AGREEMENT_VERSION
    });
  });

  it.each([
    ['the switch is off', () => isEnabled.mockResolvedValue(false)],
    ['the account is not a professional', () => find.mockResolvedValue(null)]
  ])('is a 404 that counts nothing when %s', async (_case, arrange) => {
    find.mockResolvedValue(makeProfessional({ includedClients: 30, practiceOpen: true }));
    arrange();

    await expect(CareController.practice(PRO, NOW)).rejects.toBeInstanceOf(NotFoundError);
    expect(practiceUse).not.toHaveBeenCalled();
  });
});

describe('CareController.invitation', () => {
  const CHECKED = new Date('2026-09-01T09:00:00.000Z');
  const badge = { channel: null, checkedAt: CHECKED, checkId: 'chk', dueAt: NOW, lapsesAt: NOW, number: '28/12345', register: 'CODINMA' };

  it('answers who invites, the version and the badged list with its health line, for a badged practitioner', async () => {
    openInvitation.mockResolvedValue({
      badge,
      expiresAt: new Date('2026-10-07T10:00:00.000Z'),
      professionalId: PRO.id,
      professionalName: 'Ana Dietista'
    });

    const view = await CareController.invitation(CLIENT, TOKEN, NOW);

    // The session's address, lowercased, and the token's hash — never the token.
    expect(openInvitation).toHaveBeenCalledWith(CLIENT.id, 'cliente@example.com', TOKEN_HASH, NOW);
    expect(view).toEqual({
      badge: { checkedAt: CHECKED.toISOString(), collegiateNumber: '28/12345' },
      collegiateNumber: '28/12345',
      consentVersion: CARE_CONSENT_VERSION,
      expiresAt: '2026-10-07T10:00:00.000Z',
      healthShares: CARE_HEALTH_SHARED,
      professionalName: 'Ana Dietista',
      scope: 'full',
      shares: CARE_SHARED,
      sharesPlan: []
    });
    // No id of the professional's reaches the invited account, nor the register or the check's id.
    expect(view).not.toHaveProperty('professionalId');
    expect(JSON.stringify(view)).not.toContain('CODINMA');
    expect(JSON.stringify(view)).not.toContain('chk');
  });

  it('answers the plan-only list for an un-badged practitioner: no health line, no number, no badge (PLAN 025 phase 5 step 1)', async () => {
    openInvitation.mockResolvedValue({
      badge: null,
      expiresAt: new Date('2026-10-07T10:00:00.000Z'),
      professionalId: PRO.id,
      professionalName: 'Ana Dietista'
    });

    await expect(CareController.invitation(CLIENT, TOKEN, NOW)).resolves.toEqual({
      badge: null,
      collegiateNumber: '',
      consentVersion: CARE_CONSENT_VERSION,
      expiresAt: '2026-10-07T10:00:00.000Z',
      healthShares: [],
      professionalName: 'Ana Dietista',
      scope: 'plan',
      shares: [],
      sharesPlan: CARE_SHARED_PLAN
    });
  });

  it('is a 404 when nothing matches — used, expired, foreign or unknown alike', async () => {
    openInvitation.mockResolvedValue(null);

    await expect(CareController.invitation(CLIENT, TOKEN, NOW)).rejects.toThrow(NotFoundError);
  });

  it('is the same 404, without asking, for an unconfirmed address', async () => {
    await expect(CareController.invitation({ ...CLIENT, emailVerified: false }, TOKEN, NOW)).rejects.toThrow(NotFoundError);
    expect(openInvitation).not.toHaveBeenCalled();
  });

  it('is the same 404, without asking, for something that is not a token', async () => {
    for (const token of ['short', `${TOKEN}A`, `${'A'.repeat(42)}=`, `${'A'.repeat(42)}/`]) {
      await expect(CareController.invitation(CLIENT, token, NOW)).rejects.toThrow(NotFoundError);
    }

    expect(openInvitation).not.toHaveBeenCalled();
  });

  it('does not exist while the switch is off', async () => {
    isEnabled.mockResolvedValue(false);

    await expect(CareController.invitation(CLIENT, TOKEN, NOW)).rejects.toThrow(NotFoundError);
    expect(isEnabled).toHaveBeenCalledWith('professional', false);
    expect(openInvitation).not.toHaveBeenCalled();
  });
});

describe('CareController.accept', () => {
  const answer: AcceptInvitation = { consentScope: 'full', consentVersion: CARE_CONSENT_VERSION, sharesHealth: false };

  it('makes the link and answers it, without the health items unless that line was accepted', async () => {
    accept.mockResolvedValue({ kind: 'created', link: makeLink(), professionalName: 'Ana Dietista' });

    const view = await CareController.accept(CLIENT, TOKEN, answer, NOW);

    expect(accept).toHaveBeenCalledWith(CLIENT.id, 'cliente@example.com', TOKEN_HASH, answer, NOW);
    expect(view).toEqual({
      id: '0b8e7f4a-3c2d-4e1f-9a8b-7c6d5e4f3a2b',
      consentIsCurrent: true,
      consentScope: 'full',
      consentVersion: CARE_CONSENT_VERSION,
      professionalName: 'Ana Dietista',
      professionalVerified: true,
      reconsentOffered: false,
      scope: 'full',
      shares: CARE_SHARED,
      sharesHealth: false,
      sharesPlan: [],
      since: NOW.toISOString(),
      status: 'active'
    });
  });

  it('answers the plan-only list for a link consented to `plan`', async () => {
    accept.mockResolvedValue({ kind: 'created', link: makeLink({ consentScope: 'plan' }), professionalName: 'Ana Dietista' });
    badgeOf.mockResolvedValue(null);

    await expect(CareController.accept(CLIENT, TOKEN, { ...answer, consentScope: 'plan' }, NOW)).resolves.toMatchObject({
      consentScope: 'plan',
      professionalVerified: false,
      reconsentOffered: false,
      scope: 'plan',
      shares: [],
      sharesPlan: CARE_SHARED_PLAN
    });
  });

  it('refuses under the illness rule with a state naming nothing, and queues nothing (`0111` § 8)', async () => {
    accept.mockResolvedValue({ kind: 'refused' });

    const refusal = await CareController.accept(CLIENT, TOKEN, answer, NOW).catch((error: unknown) => error);

    expect(refusal).toBeInstanceOf(CareIllnessRuleError);
    // Nothing on it: not the condition, not which of the two, not the practitioner.
    expect(Object.keys(refusal as object)).toEqual(['name']);
    expect(findUserById).not.toHaveBeenCalled();
  });

  it('lists the health items when the client shared them', async () => {
    accept.mockResolvedValue({ kind: 'created', link: makeLink({ sharesHealth: true }), professionalName: 'Ana Dietista' });

    const view = await CareController.accept(CLIENT, TOKEN, { ...answer, sharesHealth: true }, NOW);

    expect(view.shares).toEqual([...CARE_SHARED, ...CARE_HEALTH_SHARED]);
  });

  it('names the link in the way, as a state the client can act on', async () => {
    accept.mockResolvedValue({
      kind: 'exists',
      link: makeLink({ professionalId: 'usr-other', status: 'paused' }),
      professionalName: 'Otra Dietista'
    });

    const refusal = await CareController.accept(CLIENT, TOKEN, answer, NOW).catch((error: unknown) => error);

    expect(refusal).toBeInstanceOf(CareLinkExistsError);
    expect((refusal as CareLinkExistsError).link).toEqual({ professionalName: 'Otra Dietista', since: NOW.toISOString(), status: 'paused' });
  });

  it('is a 404 when there is nothing to accept', async () => {
    accept.mockResolvedValue({ kind: 'gone' });

    await expect(CareController.accept(CLIENT, TOKEN, answer, NOW)).rejects.toThrow(NotFoundError);
  });

  it('is a 404 for an unconfirmed address, and writes nothing', async () => {
    await expect(CareController.accept({ ...CLIENT, emailVerified: false }, TOKEN, answer, NOW)).rejects.toThrow(NotFoundError);
    expect(accept).not.toHaveBeenCalled();
  });

  it('does not exist while the switch is off', async () => {
    isEnabled.mockResolvedValue(false);

    await expect(CareController.accept(CLIENT, TOKEN, answer, NOW)).rejects.toThrow(NotFoundError);
    expect(accept).not.toHaveBeenCalled();
  });
});

describe('CareController.decline', () => {
  it('spends the invitation for the address it was sent to', async () => {
    decline.mockResolvedValue(true);

    await expect(CareController.decline(CLIENT, TOKEN, NOW)).resolves.toBeUndefined();
    expect(decline).toHaveBeenCalledWith(CLIENT.id, 'cliente@example.com', TOKEN_HASH, NOW);
  });

  it('is a 404 when there is nothing to decline', async () => {
    decline.mockResolvedValue(false);

    await expect(CareController.decline(CLIENT, TOKEN, NOW)).rejects.toThrow(NotFoundError);
  });

  it('does not exist while the switch is off', async () => {
    isEnabled.mockResolvedValue(false);

    await expect(CareController.decline(CLIENT, TOKEN, NOW)).rejects.toThrow(NotFoundError);
    expect(decline).not.toHaveBeenCalled();
  });
});

describe('CareController.end', () => {
  const LINK = '0b8e7f4a-3c2d-4e1f-9a8b-7c6d5e4f3a2b';

  it('ends the client’s own link, as the client, the session’s id first', async () => {
    end.mockResolvedValue(true);

    await CareController.end(CLIENT, LINK, NOW);

    expect(end).toHaveBeenCalledTimes(1);
    expect(end).toHaveBeenCalledWith(CLIENT.id, 'client', LINK, NOW);
  });

  it('ends a professional’s link, as the professional, only while they are one', async () => {
    end.mockImplementation(async (_userId, side) => side === 'professional');
    find.mockResolvedValue(makeProfessional({ userId: PRO.id }));

    await CareController.end({ ...PRO, emailVerified: true }, LINK, NOW);

    expect(find).toHaveBeenCalledWith(PRO.id);
    expect(end).toHaveBeenLastCalledWith(PRO.id, 'professional', LINK, NOW);
  });

  it('is a 404 for an account that is on neither side, and never tries the professional’s side for a non-professional', async () => {
    end.mockResolvedValue(false);
    find.mockResolvedValue(null);

    await expect(CareController.end(CLIENT, LINK, NOW)).rejects.toThrow(NotFoundError);
    expect(end).toHaveBeenCalledTimes(1);
    expect(end).toHaveBeenCalledWith(CLIENT.id, 'client', LINK, NOW);
  });

  it('lets the client end their link while the switch is off — consent stays revocable (PRD 004, criterion 4)', async () => {
    isEnabled.mockResolvedValue(false);
    end.mockResolvedValue(true);

    await expect(CareController.end(CLIENT, LINK, NOW)).resolves.toBeUndefined();
    expect(end).toHaveBeenCalledWith(CLIENT.id, 'client', LINK, NOW);
  });

  it('never tries the professional’s side while the switch is off, grant or no grant', async () => {
    isEnabled.mockResolvedValue(false);
    end.mockResolvedValue(false);
    find.mockResolvedValue(makeProfessional({ userId: PRO.id }));

    await expect(CareController.end({ ...PRO, emailVerified: true }, LINK, NOW)).rejects.toThrow(NotFoundError);
    expect(end).toHaveBeenCalledTimes(1);
    expect(end).toHaveBeenCalledWith(PRO.id, 'client', LINK, NOW);
    expect(find).not.toHaveBeenCalled();
  });

  it('is the same 404, without asking, for something that is not a link id', async () => {
    for (const linkId of ['not-a-uuid', '', `${LINK}0`, "' or 1=1 --"]) {
      await expect(CareController.end(CLIENT, linkId, NOW)).rejects.toThrow(NotFoundError);
    }

    expect(end).not.toHaveBeenCalled();
  });
});

describe('CareController.forgetAddress', () => {
  it('deletes every invitation to the deleted account’s address, lowercased, whatever the switch says', async () => {
    isEnabled.mockResolvedValue(false);
    forgetAddress.mockResolvedValue(undefined);

    await CareController.forgetAddress(' Cliente@Example.com ');

    expect(forgetAddress).toHaveBeenCalledWith('cliente@example.com');
    expect(isEnabled).not.toHaveBeenCalled();
  });
});

describe('CareController.myLink', () => {
  it('answers the client’s own link, or null', async () => {
    clientLink.mockResolvedValueOnce({ link: makeLink(), professionalName: 'Ana Dietista' }).mockResolvedValueOnce(null);

    await expect(CareController.myLink(CLIENT)).resolves.toMatchObject({ professionalName: 'Ana Dietista', status: 'active' });
    await expect(CareController.myLink(CLIENT)).resolves.toBeNull();
    expect(clientLink).toHaveBeenCalledWith(CLIENT.id);
  });

  it('answers the client whatever the switch says — what they consented to stays visible (PRD 004, criterion 4)', async () => {
    isEnabled.mockResolvedValue(false);
    clientLink.mockResolvedValue({ link: makeLink(), professionalName: 'Ana Dietista' });

    await expect(CareController.myLink(CLIENT)).resolves.toMatchObject({ professionalName: 'Ana Dietista' });
    expect(isEnabled).not.toHaveBeenCalled();
  });
});

describe('CareController.activeProfessional', () => {
  const PRACTISING = makeProfessional({ agreementVersion: PROFESSIONAL_AGREEMENT_VERSION, practiceOpen: true, userId: PRO.id });

  it('answers the client’s active professional, by id and address (PRD 004, criterion 10)', async () => {
    clientLink.mockResolvedValue({ link: makeLink(), professionalName: 'Ana Dietista' });
    find.mockResolvedValue(PRACTISING);
    findUserById.mockResolvedValue(makeUser({ id: PRO.id, email: 'dietista@example.com' }));

    await expect(CareController.activeProfessional(CLIENT.id)).resolves.toEqual({ id: PRO.id, email: 'dietista@example.com' });
    expect(clientLink).toHaveBeenCalledWith(CLIENT.id);
    expect(find).toHaveBeenCalledWith(PRO.id);
  });

  it('is null with no link, a paused or ended one, or none at all', async () => {
    clientLink.mockResolvedValue(null);

    await expect(CareController.activeProfessional(CLIENT.id)).resolves.toBeNull();

    clientLink.mockResolvedValue({ link: makeLink({ status: 'paused' }), professionalName: 'Ana Dietista' });
    await expect(CareController.activeProfessional(CLIENT.id)).resolves.toBeNull();
    expect(find).not.toHaveBeenCalled();
  });

  it('is null once the grant is gone, even with the link still active — a former professional is not told', async () => {
    clientLink.mockResolvedValue({ link: makeLink(), professionalName: 'Ana Dietista' });
    find.mockResolvedValue(null);

    await expect(CareController.activeProfessional(CLIENT.id)).resolves.toBeNull();
    expect(findUserById).not.toHaveBeenCalled();
  });

  /* PRD 025 scope 2: a practice nobody pays for is told, as `withClient` lets it through. */
  it('answers for a practice nobody pays for', async () => {
    clientLink.mockResolvedValue({ link: makeLink(), professionalName: 'Ana Dietista' });
    find.mockResolvedValue({ ...PRACTISING, practiceOpen: false });
    findUserById.mockResolvedValue(makeUser({ id: PRO.id, email: 'dietista@example.com' }));

    await expect(CareController.activeProfessional(CLIENT.id)).resolves.toEqual({ id: PRO.id, email: 'dietista@example.com' });
  });

  /* PRD 025 criterion 24: a suspended practitioner is told nothing — the client's check-in is not theirs to hear of. */
  it.each([
    ['suspended', { closing: null, suspended: { actedAt: NOW, reason: null } }],
    ['whose close has come', { closing: { id: 'c', actedAt: NOW, actedBy: null, effectiveAt: NOW, reason: null }, suspended: null }]
  ])('is null for a practitioner %s', async (_case, stands) => {
    clientLink.mockResolvedValue({ link: makeLink(), professionalName: 'Ana Dietista' });
    find.mockResolvedValue(PRACTISING);
    standing.mockResolvedValue(stands);

    await expect(CareController.activeProfessional(CLIENT.id, NOW)).resolves.toBeNull();
    expect(findUserById).not.toHaveBeenCalled();
  });

  it.each([
    ['who never accepted the agreement', { agreementVersion: null }],
    ['who has not accepted the current agreement', { agreementVersion: '0.9.0' }]
  ])('is null for a professional %s — `withClient` would refuse them too', async (_case, overrides) => {
    clientLink.mockResolvedValue({ link: makeLink(), professionalName: 'Ana Dietista' });
    find.mockResolvedValue({ ...PRACTISING, ...overrides });

    await expect(CareController.activeProfessional(CLIENT.id)).resolves.toBeNull();
    expect(findUserById).not.toHaveBeenCalled();
  });

  it('answers whatever the switch says — the link itself decides, as `myLink` does', async () => {
    isEnabled.mockResolvedValue(false);
    clientLink.mockResolvedValue({ link: makeLink(), professionalName: 'Ana Dietista' });
    find.mockResolvedValue(PRACTISING);
    findUserById.mockResolvedValue(makeUser({ id: PRO.id, email: 'dietista@example.com' }));

    await expect(CareController.activeProfessional(CLIENT.id)).resolves.toEqual({ id: PRO.id, email: 'dietista@example.com' });
    expect(isEnabled).not.toHaveBeenCalled();
  });

  /*
   * Project 025 phase 4 (`0111` § 4, PRD 025 criterion 10): that a check-in
   * happened is the client's check-ins, which only a `full` scope reaches — so
   * the notice goes nowhere else, by mail or by push.
   */
  it('reads the practitioner’s badge now, for the practitioner on the link — never anybody the caller names', async () => {
    clientLink.mockResolvedValue({ link: makeLink(), professionalName: 'Ana Dietista' });
    find.mockResolvedValue(PRACTISING);
    findUserById.mockResolvedValue(makeUser({ id: PRO.id, email: 'dietista@example.com' }));

    await CareController.activeProfessional(CLIENT.id, NOW);

    expect(badgeOf).toHaveBeenCalledExactlyOnceWith(PRO.id, NOW);
  });

  it('is null when the practitioner holds no badge — never told of a check-in they may not read', async () => {
    clientLink.mockResolvedValue({ link: makeLink(), professionalName: 'Ana Dietista' });
    find.mockResolvedValue(PRACTISING);
    badgeOf.mockResolvedValue(null);

    await expect(CareController.activeProfessional(CLIENT.id)).resolves.toBeNull();
    expect(findUserById).not.toHaveBeenCalled();
  });

  it('is null on a link consented to the plan list, even with the badge — a badge gained mid-link widens nothing', async () => {
    clientLink.mockResolvedValue({ link: makeLink({ consentScope: 'plan' }), professionalName: 'Ana Dietista' });
    find.mockResolvedValue(PRACTISING);

    await expect(CareController.activeProfessional(CLIENT.id)).resolves.toBeNull();
    expect(findUserById).not.toHaveBeenCalled();
  });
});

describe('CareController.setSharesHealth', () => {
  it('changes the session’s own link and answers it, the health items listed only while shared', async () => {
    setSharesHealth.mockResolvedValue({ link: makeLink({ sharesHealth: true }), professionalName: 'Ana Dietista' });

    const view = await CareController.setSharesHealth({ id: CLIENT.id }, { sharesHealth: true }, NOW);

    expect(setSharesHealth).toHaveBeenCalledExactlyOnceWith(CLIENT.id, true, NOW);
    expect(view).toMatchObject({ shares: [...CARE_SHARED, ...CARE_HEALTH_SHARED], sharesHealth: true, status: 'active' });

    setSharesHealth.mockResolvedValue({ link: makeLink({ sharesHealth: false, status: 'paused' }), professionalName: 'Ana Dietista' });

    await expect(CareController.setSharesHealth({ id: CLIENT.id }, { sharesHealth: false }, NOW)).resolves.toMatchObject({
      shares: CARE_SHARED,
      sharesHealth: false,
      status: 'paused'
    });
  });

  it('is a 404 for a client with no open link', async () => {
    setSharesHealth.mockResolvedValue(null);

    await expect(CareController.setSharesHealth({ id: CLIENT.id }, { sharesHealth: false }, NOW)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('works with the switch off: consent stays the client’s to change, and the switch is not asked', async () => {
    isEnabled.mockResolvedValue(false);
    setSharesHealth.mockResolvedValue({ link: makeLink(), professionalName: 'Ana Dietista' });

    await expect(CareController.setSharesHealth({ id: CLIENT.id }, { sharesHealth: false }, NOW)).resolves.toMatchObject({ sharesHealth: false });
    expect(isEnabled).not.toHaveBeenCalled();
  });
});

describe('CareController.myLink — the consent version', () => {
  it('says whether the link was accepted at today’s consent version', async () => {
    clientLink.mockResolvedValueOnce({ link: makeLink(), professionalName: 'Ana Dietista' });
    clientLink.mockResolvedValueOnce({ link: makeLink({ consentVersion: '1.0.0' }), professionalName: 'Ana Dietista' });

    await expect(CareController.myLink({ id: CLIENT.id })).resolves.toMatchObject({ consentIsCurrent: true });
    await expect(CareController.myLink({ id: CLIENT.id })).resolves.toMatchObject({ consentIsCurrent: false, consentVersion: '1.0.0' });
  });
});

describe('CareController.forgetExpiredInvitations', () => {
  it('deletes every invitation past its date and says how many', async () => {
    forgetExpired.mockResolvedValue(3);

    await expect(CareController.forgetExpiredInvitations(NOW)).resolves.toBe(3);
    expect(forgetExpired).toHaveBeenCalledExactlyOnceWith(NOW);
  });
});

/*
 * Project 025 phase 5 (`0111` § 4, PLAN step 1): the client's own link says what
 * it opens now — by its consent and the practitioner's badge, read for this
 * answer — and whether the badged list is on offer.
 */
describe('CareController.myLink — what the link opens now', () => {
  it.each([
    ['full', true, 'full', false],
    ['full', false, 'plan', false],
    ['plan', true, 'plan', true],
    ['plan', false, 'plan', false]
  ] as const)('consented to `%s`, badged: %s — opens `%s`, re-consent on offer: %s', async (consentScope, badged, scope, offered) => {
    clientLink.mockResolvedValue({ link: makeLink({ consentScope, sharesHealth: true }), professionalName: 'Ana Dietista' });
    badgeOf.mockResolvedValue(badged ? { number: '28-1234' } : null);

    const view = await CareController.myLink({ id: CLIENT.id }, NOW);

    expect(badgeOf).toHaveBeenCalledExactlyOnceWith(PRO.id, NOW);
    expect(view).toMatchObject({ consentScope, professionalVerified: badged, reconsentOffered: offered, scope, sharesHealth: true });
    // The list is the scope's: the badged one with its health items, or the plan-only one — never both.
    expect(view?.shares).toEqual(scope === 'full' ? [...CARE_SHARED, ...CARE_HEALTH_SHARED] : []);
    expect(view?.sharesPlan).toEqual(scope === 'full' ? [] : CARE_SHARED_PLAN);
  });
});

describe('CareController.reconsent — the client widens their own link (`textos/05` § F.4)', () => {
  it('widens the session’s link, at the version read, and answers it opening `full`', async () => {
    reconsent.mockResolvedValue({ link: makeLink({ consentScope: 'full' }), professionalName: 'Ana Dietista' });

    await expect(CareController.reconsent({ id: CLIENT.id }, { consentVersion: CARE_CONSENT_VERSION }, NOW)).resolves.toMatchObject({
      consentScope: 'full',
      reconsentOffered: false,
      scope: 'full',
      shares: CARE_SHARED,
      sharesHealth: false
    });
    expect(reconsent).toHaveBeenCalledExactlyOnceWith(CLIENT.id, CARE_CONSENT_VERSION, NOW);
  });

  it('is the same 404 when there is nothing to widen — no link, already `full`, or no badge now', async () => {
    reconsent.mockResolvedValue(null);

    await expect(CareController.reconsent({ id: CLIENT.id }, { consentVersion: CARE_CONSENT_VERSION }, NOW)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('does not exist while the switch is off: it is a consent given', async () => {
    isEnabled.mockResolvedValue(false);

    // The same message as every other refusal of this route: nothing tells the switch apart.
    await expect(CareController.reconsent({ id: CLIENT.id }, { consentVersion: CARE_CONSENT_VERSION }, NOW)).rejects.toThrow(
      new NotFoundError('Link not found')
    );
    expect(reconsent).not.toHaveBeenCalled();
  });
});

describe('CareController.setSharesHealth — refused outside `full` (PRD 025 criterion 11)', () => {
  it('is the same 404 as no link when the repository refuses it', async () => {
    setSharesHealth.mockResolvedValue(null);

    await expect(CareController.setSharesHealth({ id: CLIENT.id }, { sharesHealth: true }, NOW)).rejects.toBeInstanceOf(NotFoundError);
    expect(setSharesHealth).toHaveBeenCalledExactlyOnceWith(CLIENT.id, true, NOW);
  });
});

describe('CareController.endedLink — the client’s own notice (`textos/05` § G.3)', () => {
  it.each(['badge_lost', 'declared'] as const)(
    'answers the name, the day and which ending (%s) of a link the rule ended, for the session alone',
    async reason => {
      lastEndedByRule.mockResolvedValue({ endedAt: NOW, professionalName: 'Ana Dietista', reason });

      await expect(CareController.endedLink({ id: CLIENT.id })).resolves.toEqual({
        endedAt: NOW.toISOString(),
        professionalName: 'Ana Dietista',
        reason
      });
      expect(lastEndedByRule).toHaveBeenCalledExactlyOnceWith(CLIENT.id);
    }
  );

  it('is null otherwise, whatever the switch says', async () => {
    isEnabled.mockResolvedValue(false);
    lastEndedByRule.mockResolvedValue(null);

    await expect(CareController.endedLink({ id: CLIENT.id })).resolves.toBeNull();
    expect(isEnabled).not.toHaveBeenCalled();
  });
});

describe('CareController.sweepBadgeLoss — a badge gone, in the daily sweep (`0111` §§ 4 and 8)', () => {
  it('answers each ended link’s client and their address — never the practitioner’s — and how many narrowed', async () => {
    sweepBadgeLoss.mockResolvedValue({ ended: [{ clientId: CLIENT.id, linkId: 'l', professionalName: 'Ana Dietista' }], narrowed: 2 });
    findUserById.mockResolvedValue(makeUser({ id: CLIENT.id, email: 'cliente@example.com' }));

    await expect(CareController.sweepBadgeLoss(NOW)).resolves.toEqual({
      ended: [{ clientId: CLIENT.id, professionalName: 'Ana Dietista', to: 'cliente@example.com' }],
      narrowed: 2
    });
    expect(sweepBadgeLoss).toHaveBeenCalledExactlyOnceWith(NOW);
    expect(findUserById).toHaveBeenCalledExactlyOnceWith(CLIENT.id);
  });

  it('answers no address for a client whose account is gone, and reads no account for a narrowing', async () => {
    sweepBadgeLoss.mockResolvedValue({ ended: [{ clientId: CLIENT.id, linkId: 'l', professionalName: 'Ana Dietista' }], narrowed: 0 });
    findUserById.mockResolvedValue(undefined);

    await expect(CareController.sweepBadgeLoss(NOW)).resolves.toEqual({
      ended: [{ clientId: CLIENT.id, professionalName: 'Ana Dietista', to: null }],
      narrowed: 0
    });

    sweepBadgeLoss.mockResolvedValue({ ended: [], narrowed: 3 });
    findUserById.mockClear();
    await CareController.sweepBadgeLoss(NOW);
    expect(findUserById).not.toHaveBeenCalled();
  });
});
