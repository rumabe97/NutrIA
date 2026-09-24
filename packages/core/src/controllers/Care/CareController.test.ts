import { createHash } from 'node:crypto';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { makeProfessional, makeUser } from '#test/fixtures';
import { CARE_CONSENT_VERSION, CARE_HEALTH_SHARED, CARE_SHARED, CARE_TOKEN_PATTERN } from 'core/entities/Care';
import { CareLinkExistsError, InputParseError, NotFoundError } from 'core/entities/Error';

import { CareController } from './CareController';

import type { AcceptOutcome, LinkWithProfessional, OpenInvitation } from '#repositories/Care';
import type { AcceptInvitation, CareInvitation, CareLink } from 'core/entities/Care';
import type { Professional } from 'core/entities/Professional';
import type { User } from 'core/entities/User';

const accept = vi.fn<(clientId: string, email: string, tokenHash: string, answer: AcceptInvitation, now: Date) => Promise<AcceptOutcome>>();
const clientLink = vi.fn<(clientId: string) => Promise<LinkWithProfessional | null>>();
const decline = vi.fn<(clientId: string, email: string, tokenHash: string, now: Date) => Promise<boolean>>();
const end = vi.fn<(userId: string, side: 'client' | 'professional', linkId: string, now: Date) => Promise<boolean>>();
const forgetAddress = vi.fn<(email: string) => Promise<void>>();
const invite = vi.fn<(professionalId: string, email: string, tokenHash: string, expiresAt: Date, now: Date) => Promise<CareInvitation>>();
const openInvitation = vi.fn<(clientId: string, email: string, tokenHash: string, now: Date) => Promise<OpenInvitation | null>>();
const find = vi.fn<(userId: string) => Promise<Professional | null>>();
const isEnabled = vi.fn<(key: string, fallback: boolean) => Promise<boolean>>();
const findUserById = vi.fn<(id: string) => Promise<User | undefined>>();

vi.mock('#repositories/User', () => ({ UserRepository: { findById: (id: string) => findUserById(id) } }));
vi.mock('#repositories/Care', () => ({
  CareRepository: {
    accept: (...args: Parameters<typeof accept>) => accept(...args),
    clientLink: (clientId: string) => clientLink(clientId),
    decline: (...args: Parameters<typeof decline>) => decline(...args),
    end: (...args: Parameters<typeof end>) => end(...args),
    forgetAddress: (email: string) => forgetAddress(email),
    invite: (...args: Parameters<typeof invite>) => invite(...args),
    openInvitation: (...args: Parameters<typeof openInvitation>) => openInvitation(...args)
  }
}));
vi.mock('#repositories/Professional', () => ({ ProfessionalRepository: { find: (userId: string) => find(userId) } }));
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

beforeEach(() => {
  for (const mock of [accept, clientLink, decline, end, forgetAddress, invite, openInvitation, find, isEnabled, findUserById]) {
    mock.mockReset();
  }

  isEnabled.mockResolvedValue(true);
});

describe('CareController.invite', () => {
  it('stores only the hash of a fresh token, lowercased address, fourteen days out — and hands the token back for the mail alone', async () => {
    invite.mockImplementation(async (professionalId, email, tokenHash, expiresAt) => ({
      id: '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f',
      createdAt: NOW,
      email,
      expiresAt,
      professionalId,
      tokenHash,
      updatedAt: NOW
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
      id: '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f',
      createdAt: NOW,
      email,
      expiresAt,
      professionalId,
      tokenHash,
      updatedAt: NOW
    }));

    const first = await CareController.invite(PRO, { email: 'a@example.com' }, NOW);
    const second = await CareController.invite(PRO, { email: 'a@example.com' }, NOW);

    expect(first.token).not.toBe(second.token);
  });

  it('refuses the professional’s own address, whatever its case, and writes nothing', async () => {
    await expect(CareController.invite(PRO, { email: 'DIETISTA@example.com' }, NOW)).rejects.toThrow(InputParseError);
    expect(invite).not.toHaveBeenCalled();
  });
});

describe('CareController.invitation', () => {
  it('answers who invites, the version and both lists, for the address it was sent to', async () => {
    openInvitation.mockResolvedValue({ expiresAt: new Date('2026-10-07T10:00:00.000Z'), professionalId: PRO.id, professionalName: 'Ana Dietista' });

    const view = await CareController.invitation(CLIENT, TOKEN, NOW);

    // The session's address, lowercased, and the token's hash — never the token.
    expect(openInvitation).toHaveBeenCalledWith(CLIENT.id, 'cliente@example.com', TOKEN_HASH, NOW);
    expect(view).toEqual({
      consentVersion: CARE_CONSENT_VERSION,
      expiresAt: '2026-10-07T10:00:00.000Z',
      healthShares: CARE_HEALTH_SHARED,
      professionalName: 'Ana Dietista',
      shares: CARE_SHARED
    });
    // No id of the professional's reaches the invited account.
    expect(view).not.toHaveProperty('professionalId');
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
  const answer: AcceptInvitation = { consentVersion: CARE_CONSENT_VERSION, sharesHealth: false };

  it('makes the link and answers it, without the health items unless that line was accepted', async () => {
    accept.mockResolvedValue({ kind: 'created', link: makeLink(), professionalName: 'Ana Dietista' });

    const view = await CareController.accept(CLIENT, TOKEN, answer, NOW);

    expect(accept).toHaveBeenCalledWith(CLIENT.id, 'cliente@example.com', TOKEN_HASH, answer, NOW);
    expect(view).toEqual({
      id: '0b8e7f4a-3c2d-4e1f-9a8b-7c6d5e4f3a2b',
      consentVersion: CARE_CONSENT_VERSION,
      professionalName: 'Ana Dietista',
      shares: CARE_SHARED,
      sharesHealth: false,
      since: NOW.toISOString(),
      status: 'active'
    });
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
  it('answers the client’s active professional, by id and address (PRD 004, criterion 10)', async () => {
    clientLink.mockResolvedValue({ link: makeLink(), professionalName: 'Ana Dietista' });
    find.mockResolvedValue(makeProfessional({ userId: PRO.id }));
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

  it('answers whatever the switch says — the link itself decides, as `myLink` does', async () => {
    isEnabled.mockResolvedValue(false);
    clientLink.mockResolvedValue({ link: makeLink(), professionalName: 'Ana Dietista' });
    find.mockResolvedValue(makeProfessional({ userId: PRO.id }));
    findUserById.mockResolvedValue(makeUser({ id: PRO.id, email: 'dietista@example.com' }));

    await expect(CareController.activeProfessional(CLIENT.id)).resolves.toEqual({ id: PRO.id, email: 'dietista@example.com' });
    expect(isEnabled).not.toHaveBeenCalled();
  });
});
