import { beforeEach, describe, expect, it, vi } from 'vitest';

import AdminIndex from './page';

const serverApi = vi.fn<(path: string) => Promise<unknown>>();
const notFound = vi.fn<() => never>(() => {
  throw new Error('NEXT_NOT_FOUND');
});
const redirect = vi.fn<(to: string) => never>(() => {
  throw new Error('NEXT_REDIRECT');
});

vi.mock('lib/server-api', () => ({ serverApi: (path: string) => serverApi(path) }));
vi.mock('next/navigation', () => ({ notFound: () => notFound(), redirect: (to: string) => redirect(to) }));

function visit(query: Record<string, string | string[] | undefined> = {}) {
  return AdminIndex({ searchParams: Promise.resolve(query) });
}

/*
 * The layout's 404 is not guaranteed to land before this page's redirect, so the page asks
 * the gate's question itself: a redirect to a stranger would confirm the address (`0068`).
 */
describe('/admin until Resumen exists', () => {
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

    await expect(visit({ abierta: 'someone@example.com' })).rejects.toThrow('NEXT_NOT_FOUND');
    expect(redirect).not.toHaveBeenCalled();
  });

  it('sends an admin to the transition page with the query string kept', async () => {
    serverApi.mockResolvedValue({ role: 'admin' });

    await expect(visit({ abierta: 'someone@example.com' })).rejects.toThrow('NEXT_REDIRECT');
    expect(redirect).toHaveBeenCalledWith('/admin/anterior?abierta=someone%40example.com');
  });

  it('sends an admin to the bare transition page when there is no query', async () => {
    serverApi.mockResolvedValue({ role: 'admin' });

    await expect(visit()).rejects.toThrow('NEXT_REDIRECT');
    expect(redirect).toHaveBeenCalledWith('/admin/anterior');
  });
});
