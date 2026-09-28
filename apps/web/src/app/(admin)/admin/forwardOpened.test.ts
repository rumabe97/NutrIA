import { beforeEach, describe, expect, it, vi } from 'vitest';

import { forwardOpened } from './forwardOpened';

const serverApi = vi.fn<(path: string) => Promise<unknown>>();
const notFound = vi.fn<() => never>(() => {
  throw new Error('NEXT_NOT_FOUND');
});
const redirect = vi.fn<(to: string) => never>(() => {
  throw new Error('NEXT_REDIRECT');
});

vi.mock('lib/server-api', () => ({ serverApi: (path: string) => serverApi(path) }));
vi.mock('next/navigation', () => ({ notFound: () => notFound(), redirect: (to: string) => redirect(to) }));

/*
 * Resumen (`/admin`) awaits this first. The mailed activation link lands on
 * `/admin?abierta=…` and is sent on to Cuentas. The layout's 404 is not guaranteed to
 * land before the page's redirect, so the gate's question is asked here too: a redirect
 * to a stranger would confirm the address (`0068`).
 */
describe('/admin with ?abierta=', () => {
  beforeEach(() => {
    serverApi.mockReset();
    notFound.mockClear();
    redirect.mockClear();
  });

  it.each([
    ['no session', null],
    ['an ordinary account', { role: 'user' }]
  ])('answers %s with a 404, never a redirect', async (_who, user) => {
    serverApi.mockResolvedValue(user);

    await expect(forwardOpened({ abierta: 'someone@example.com' })).rejects.toThrow('NEXT_NOT_FOUND');
    expect(redirect).not.toHaveBeenCalled();
  });

  it('sends an admin to Cuentas with the address kept', async () => {
    serverApi.mockResolvedValue({ role: 'admin' });

    await expect(forwardOpened({ abierta: 'someone@example.com' })).rejects.toThrow('NEXT_REDIRECT');
    expect(serverApi).toHaveBeenCalledWith('/users/me');
    expect(redirect).toHaveBeenCalledWith('/admin/cuentas?abierta=someone%40example.com');
  });

  it('keeps every other parameter, repeated ones included', async () => {
    serverApi.mockResolvedValue({ role: 'admin' });

    await expect(forwardOpened({ abierta: ['a@example.com', 'b@example.com'], period: '7' })).rejects.toThrow('NEXT_REDIRECT');
    expect(redirect).toHaveBeenCalledWith('/admin/cuentas?abierta=a%40example.com&abierta=b%40example.com&period=7');
  });

  it('does nothing for a request without it — no read, no redirect, no 404', async () => {
    await expect(forwardOpened({ period: '7' })).resolves.toBeUndefined();
    expect(serverApi).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
    expect(notFound).not.toHaveBeenCalled();
  });
});
