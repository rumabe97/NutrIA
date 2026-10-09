import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SignInDeviceController } from './SignInDeviceController';

const whoseIs = vi.fn<(token: string, now: Date) => Promise<string | null>>();
const renew = vi.fn<(userId: string, token: string, now: Date, expiresAt: Date) => Promise<boolean>>();
const issue = vi.fn<(userId: string, token: string, expiresAt: Date, keep: number) => Promise<void>>();
const forgetAll = vi.fn<(userId: string) => Promise<number>>();

vi.mock('#repositories/SignInDevice', () => ({
  SignInDeviceRepository: {
    forgetAll: (userId: string) => forgetAll(userId),
    issue: (userId: string, token: string, expiresAt: Date, keep: number) => issue(userId, token, expiresAt, keep),
    renew: (userId: string, token: string, now: Date, expiresAt: Date) => renew(userId, token, now, expiresAt),
    whoseIs: (token: string, now: Date) => whoseIs(token, now)
  }
}));

const NOW = new Date('2026-10-09T10:00:00.000Z');
const ENDS = new Date('2027-01-07T10:00:00.000Z');

beforeEach(() => {
  whoseIs.mockReset();
  renew.mockReset();
  issue.mockReset();
  forgetAll.mockReset();
});

describe('SignInDeviceController.exempts', () => {
  it('is false without a cookie, and asks the database nothing', async () => {
    await expect(SignInDeviceController.exempts(null, 'ana@example.com', NOW)).resolves.toBe(false);
    expect(whoseIs).not.toHaveBeenCalled();
  });

  it('is true for a cookie earned for the account that owns the address, whatever its case', async () => {
    whoseIs.mockResolvedValue('Ana@Example.com');

    await expect(SignInDeviceController.exempts('token', 'ana@example.com', NOW)).resolves.toBe(true);
    expect(whoseIs).toHaveBeenCalledWith('token', NOW);
  });

  it('is false for a cookie earned for another account', async () => {
    whoseIs.mockResolvedValue('bea@example.com');

    await expect(SignInDeviceController.exempts('token', 'ana@example.com', NOW)).resolves.toBe(false);
  });

  it('is false for a cookie nobody knows or that has expired', async () => {
    whoseIs.mockResolvedValue(null);

    await expect(SignInDeviceController.exempts('token', 'ana@example.com', NOW)).resolves.toBe(false);
  });

  it('lets the failure out, for the API to fall back to the brake', async () => {
    whoseIs.mockRejectedValue(new Error('down'));

    await expect(SignInDeviceController.exempts('token', 'ana@example.com', NOW)).rejects.toThrow('down');
  });
});

describe('SignInDeviceController.remember', () => {
  it('renews the browser’s own cookie for ninety days and hands the same token back', async () => {
    renew.mockResolvedValue(true);

    await expect(SignInDeviceController.remember('usr-1', 'mine', NOW)).resolves.toBe('mine');
    expect(renew).toHaveBeenCalledWith('usr-1', 'mine', NOW, ENDS);
    expect(issue).not.toHaveBeenCalled();
  });

  it('issues a new token, keeping the newest ten, when the browser has none', async () => {
    const token = await SignInDeviceController.remember('usr-1', null, NOW);

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(renew).not.toHaveBeenCalled();
    expect(issue).toHaveBeenCalledWith('usr-1', token, ENDS, 10);
  });

  it('issues a new token when the one presented is not good for this account', async () => {
    renew.mockResolvedValue(false);

    const token = await SignInDeviceController.remember('usr-1', 'someone-elses', NOW);

    expect(token).not.toBe('someone-elses');
    expect(issue).toHaveBeenCalledWith('usr-1', token, ENDS, 10);
  });
});

describe('SignInDeviceController.forgetAll', () => {
  it('ends every cookie of the account and says how many', async () => {
    forgetAll.mockResolvedValue(3);

    await expect(SignInDeviceController.forgetAll('usr-1')).resolves.toBe(3);
    expect(forgetAll).toHaveBeenCalledWith('usr-1');
  });
});
