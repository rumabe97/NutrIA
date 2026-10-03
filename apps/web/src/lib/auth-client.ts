'use client';
import { createAuthClient } from 'better-auth/react';

import { passkeyClient } from '@better-auth/passkey/client';
import { twoFactorClient } from 'better-auth/client/plugins';

import { AUTH_BASE_PATH, AUTH_ORIGIN } from './env';

/**
 * Better Auth's browser client. It only ever moves an httpOnly cookie around —
 * no token is stored in `localStorage`, where any script on the page could read
 * it.
 *
 * `twoFactorClient` with no options: it would otherwise navigate on its own when a
 * sign-in answers `twoFactorRedirect`. `SignInForm` does that itself, so the
 * challenge keeps the language and the `?siguiente` the sign-in had.
 *
 * `passkeyClient` (PLAN 011 phase 5): `passkey.addPasskey`, `passkey.listUserPasskeys`,
 * `passkey.deletePasskey` and `signIn.passkey`. Its sign-in only sets the session cookie;
 * where to go next is the caller's, as after a password.
 */
export const authClient = createAuthClient({ basePath: AUTH_BASE_PATH, baseURL: AUTH_ORIGIN, plugins: [twoFactorClient(), passkeyClient()] });

export const { signIn, signOut, signUp, useSession } = authClient;
