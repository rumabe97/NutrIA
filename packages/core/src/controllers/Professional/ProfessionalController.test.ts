import { beforeEach, describe, expect, it, vi } from 'vitest';

import { makeProfessional, makeUser } from '#test/fixtures';
import { NotFoundError } from 'core/entities/Error';

import { ProfessionalController } from './ProfessionalController';

import type { ProfessionalListRow } from '#repositories/Professional';
import type { Professional } from 'core/entities/Professional';
import type { User } from 'core/entities/User';

const find = vi.fn<(userId: string) => Promise<Professional | null>>();
const grant = vi.fn<(userId: string, collegiateNumber: string, grantedBy: string) => Promise<Professional>>();
const list = vi.fn<() => Promise<readonly ProfessionalListRow[]>>();
const revoke = vi.fn<(userId: string) => Promise<boolean>>();
const findById = vi.fn<(id: string) => Promise<User | undefined>>();
const isEnabled = vi.fn<(key: string, fallback: boolean) => Promise<boolean>>();

vi.mock('#repositories/Professional', () => ({
  ProfessionalRepository: {
    find: (userId: string) => find(userId),
    grant: (userId: string, collegiateNumber: string, grantedBy: string) => grant(userId, collegiateNumber, grantedBy),
    list: () => list(),
    revoke: (userId: string) => revoke(userId)
  }
}));
vi.mock('#repositories/User', () => ({ UserRepository: { findById: (id: string) => findById(id) } }));
vi.mock('#repositories/Settings', () => ({ SettingsRepository: { isEnabled: (key: string, fallback: boolean) => isEnabled(key, fallback) } }));

beforeEach(() => {
  find.mockReset();
  grant.mockReset();
  list.mockReset();
  revoke.mockReset();
  findById.mockReset();
  isEnabled.mockReset();
});

describe('ProfessionalController.grant', () => {
  it('records the owner’s act on an existing account and answers the account, never the granter', async () => {
    findById.mockResolvedValue(makeUser({ id: 'usr-dietitian', email: 'dietista@example.com' }));
    grant.mockResolvedValue(makeProfessional({ grantedBy: 'usr-owner', userId: 'usr-dietitian' }));

    const view = await ProfessionalController.grant('usr-dietitian', { collegiateNumber: 'MAD00123' }, 'usr-owner');

    expect(grant).toHaveBeenCalledWith('usr-dietitian', 'MAD00123', 'usr-owner');
    expect(view).toEqual({
      collegiateNumber: 'MAD00123',
      email: 'dietista@example.com',
      grantedAt: '2026-09-23T10:00:00.000Z',
      links: { active: 0, ended: 0, paused: 0 },
      userId: 'usr-dietitian'
    });
    expect(view).not.toHaveProperty('grantedBy');
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
});

describe('ProfessionalController.revoke', () => {
  it('takes the grant back', async () => {
    revoke.mockResolvedValue(true);

    await expect(ProfessionalController.revoke('usr-dietitian')).resolves.toBeUndefined();
    expect(revoke).toHaveBeenCalledWith('usr-dietitian');
  });

  it('is a 404 when the account was never a professional', async () => {
    revoke.mockResolvedValue(false);

    await expect(ProfessionalController.revoke('usr-dietitian')).rejects.toThrow(NotFoundError);
  });
});

describe('ProfessionalController.find', () => {
  it('presents the professional’s own grant without the granter’s id', async () => {
    find.mockResolvedValue(makeProfessional({ grantedBy: 'usr-owner', includedClients: 30, practiceOpen: true }));

    const view = await ProfessionalController.find('usr-dietitian');

    expect(view).toEqual({ collegiateNumber: 'MAD00123', grantedAt: '2026-09-23T10:00:00.000Z', includedClients: 30, practiceOpen: true });
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
});

describe('ProfessionalController.list', () => {
  it('names each professional’s account and counts their links, and nothing about a client', async () => {
    list.mockResolvedValue([
      {
        collegiateNumber: 'CV-0456',
        email: 'b@example.com',
        grantedAt: new Date('2026-09-23T11:00:00.000Z'),
        includedClients: 0,
        practiceOpen: false,
        userId: 'usr-b'
      },
      {
        collegiateNumber: 'MAD00123',
        email: 'a@example.com',
        grantedAt: new Date('2026-09-23T10:00:00.000Z'),
        includedClients: 30,
        practiceOpen: true,
        userId: 'usr-a'
      }
    ]);

    const rows = await ProfessionalController.list();

    expect(rows).toEqual([
      {
        collegiateNumber: 'CV-0456',
        email: 'b@example.com',
        grantedAt: '2026-09-23T11:00:00.000Z',
        links: { active: 0, ended: 0, paused: 0 },
        userId: 'usr-b'
      },
      {
        collegiateNumber: 'MAD00123',
        email: 'a@example.com',
        grantedAt: '2026-09-23T10:00:00.000Z',
        links: { active: 0, ended: 0, paused: 0 },
        userId: 'usr-a'
      }
    ]);
    // The keys are the whole contract of `0028` here: no client id, name or address may ever join them.
    expect(Object.keys(rows[0] ?? {}).sort()).toEqual(['collegiateNumber', 'email', 'grantedAt', 'links', 'userId']);
  });
});
