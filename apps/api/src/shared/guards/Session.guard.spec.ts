import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, jest } from '@jest/globals';

import { SessionGuard } from './Session.guard.js';

import type { Auth } from '../../modules/auth/auth.config.js';
import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';

type Session = { user: { id: string; email: string; emailVerified: boolean; name: string; role?: string } } | null;

function makeContext(request: Record<string, unknown> = { headers: {} }): ExecutionContext {
  return {
    getClass: () => class {},
    getHandler: () => () => undefined,
    switchToHttp: () => ({ getRequest: () => request })
  } as unknown as ExecutionContext;
}

function makeGuard(session: Session, isPublic = false) {
  const getSession = jest.fn<() => Promise<Session>>().mockResolvedValue(session);
  const auth = { api: { getSession } } as unknown as Auth;
  const reflector = { getAllAndOverride: () => isPublic } as unknown as Reflector;

  return { getSession, guard: new SessionGuard(auth, reflector) };
}

const session: Session = { user: { id: 'usr_1', email: 'ada@example.com', emailVerified: true, name: 'Ada', role: 'user' } };

describe('SessionGuard', () => {
  it('denies an unauthenticated request', async () => {
    const { guard } = makeGuard(null);

    await expect(guard.canActivate(makeContext())).rejects.toThrow(NotFoundException);
  });

  it('denies with 404 rather than 401 or 403 — a distinct status confirms the route exists', async () => {
    const { guard } = makeGuard(null);

    await expect(guard.canActivate(makeContext())).rejects.toMatchObject({ status: 404 });
  });

  it('allows a request carrying a valid session', async () => {
    const { guard } = makeGuard(session);

    await expect(guard.canActivate(makeContext())).resolves.toBe(true);
  });

  it('attaches the session user to the request for @CurrentUser', async () => {
    const request: Record<string, unknown> = { headers: {} };
    const { guard } = makeGuard(session);

    await guard.canActivate(makeContext(request));

    expect(request.user).toEqual({ id: 'usr_1', email: 'ada@example.com', emailVerified: true, name: 'Ada', role: 'user' });
  });

  it('defaults a missing role to `user` — never to something privileged', async () => {
    const request: Record<string, unknown> = { headers: {} };
    const { guard } = makeGuard({ user: { id: 'usr_2', email: 'a@b.c', emailVerified: true, name: 'A' } });

    await guard.canActivate(makeContext(request));

    expect((request.user as { role: string }).role).toBe('user');
  });

  it('lets a @Public() route through without consulting the session store', async () => {
    const { getSession, guard } = makeGuard(null, true);

    await expect(guard.canActivate(makeContext())).resolves.toBe(true);
    expect(getSession).not.toHaveBeenCalled();
  });

  it('re-reads the session on every request so a logout takes effect immediately', async () => {
    const { getSession, guard } = makeGuard(session);

    await guard.canActivate(makeContext());
    await guard.canActivate(makeContext());

    expect(getSession).toHaveBeenCalledTimes(2);
  });
});
