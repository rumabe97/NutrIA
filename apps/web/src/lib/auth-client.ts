'use client';
import { createAuthClient } from 'better-auth/react';

import { AUTH_BASE_PATH, AUTH_ORIGIN } from './env';

/**
 * Better Auth's browser client. It only ever moves an httpOnly cookie around —
 * no token is stored in `localStorage`, where any script on the page could read
 * it.
 */
export const authClient = createAuthClient({ basePath: AUTH_BASE_PATH, baseURL: AUTH_ORIGIN });

export const { signIn, signOut, signUp, useSession } = authClient;
