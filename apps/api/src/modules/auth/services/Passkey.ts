import { Logger } from '@nestjs/common';
import { getSessionFromCtx } from 'better-auth/api';

import { UserController } from 'core/controllers/User';

import { record, text } from './PasswordPolicy.js';
import { notFound } from './TwoFactor.js';

import type { BackgroundTaskService } from '../../../shared/services/index.js';
import type { Context } from './PasswordPolicy.js';

/** Whom a new passkey is about, and what the mail needs from the request that added it. */
export type PasskeyNotice = {
  readonly id: string;
  readonly acceptLanguage: string | null;
  readonly email: string;
  readonly userAgent: string | null;
};

export type PasskeyDeps = {
  readonly background: Pick<BackgroundTaskService, 'run'>;
  /** Sends "you added a passkey"; run in the background, never awaited by a route. */
  readonly mailPasskeyAdded: (notice: PasskeyNotice) => Promise<void>;
};

/** What the person's device shows beside the key it keeps. */
export const PASSKEY_RP_NAME = 'NutrIA';

const VERIFY_REGISTRATION = '/passkey/verify-registration';
const DELETE = '/passkey/delete-passkey';
const UPDATE = '/passkey/update-passkey';

/** The plugin's routes that name one passkey by `id` in the body. */
const BY_ID: ReadonlySet<string> = new Set([DELETE, UPDATE]);

const logger = new Logger('Passkey');

/**
 * The relying party, from the web's own address (PLAN 011 phase 5): the
 * browser makes and uses a passkey for the page's origin, which is `APP_URL`
 * — in production the API is reached through the web's rewrite, so
 * `BETTER_AUTH_URL` is that origin too, and locally it is not. No variable of
 * its own: a local run and production each get theirs, and a new domain is a
 * new `APP_URL` that voids every passkey made before it (`0074`).
 */
export function passkeyOptions(appUrl: string): { origin: string; rpID: string; rpName: string } {
  const web = new URL(appUrl);

  return { origin: web.origin, rpID: web.hostname, rpName: PASSKEY_RP_NAME };
}

/**
 * Before the plugin (PLAN 011 phase 5):
 *
 * - `/passkey/delete-passkey` and `/passkey/update-passkey` for a passkey that
 *   is not one of the caller's — another account's, or none at all — are the
 *   guard's 404, byte for byte. The plugin would answer 401
 *   `YOU_ARE_NOT_ALLOWED_TO_REGISTER_THIS_PASSKEY` for another account's and
 *   404 `PASSKEY_NOT_FOUND` for a made-up id: two answers that tell which ids
 *   exist. No session, or no id, is left to the route's own 401 or 400.
 * - `/passkey/verify-registration`: `createSession` is forced to `false`. A
 *   passkey is added from a session the person already has; minting a second
 *   one there would be a sign-in nobody made.
 */
export async function passkeyBefore(context: Context): Promise<{ context: { body: Record<string, unknown> } } | undefined> {
  const path = context.path ?? '';

  if (path === VERIFY_REGISTRATION) {
    return { context: { body: { ...record(context.body), createSession: false } } };
  }

  if (!BY_ID.has(path)) {
    return undefined;
  }

  const id = text(record(context.body).id);
  const caller = await getSessionFromCtx(context);

  if (!id || !caller) {
    return undefined;
  }

  const owned = await context.context.adapter.findOne<{ userId: string }>({
    model: 'passkey',
    where: [
      { field: 'id', value: id },
      { field: 'userId', value: caller.user.id }
    ]
  });

  if (!owned) {
    throw notFound();
  }

  return undefined;
}

/**
 * After the plugin, on a 2xx only (called from `accountSecurityAfter`):
 *
 * - `/passkey/verify-registration`: `auth.passkey_added`, awaited — the trail
 *   must not lag the answer — then the mail in the background. The passkey is
 *   the session's own account's: the plugin refuses a challenge made for
 *   anybody else.
 * - `/passkey/delete-passkey`: `auth.passkey_removed`, no mail — the person
 *   took a key away, and the one who could abuse that already had a session.
 *
 * A failed row is a line, not a 500: the passkey did change. Neither the row
 * nor the line carries the passkey's id, name, key or anything of the device.
 */
export async function passkeyAfter(deps: PasskeyDeps, context: Context): Promise<void> {
  const path = context.path ?? '';
  const user = context.context.session?.user;

  if (!user || (path !== VERIFY_REGISTRATION && path !== DELETE)) {
    return;
  }

  const added = path === VERIFY_REGISTRATION;

  try {
    await UserController.passkeyChanged(user.id, added);
  } catch {
    logger.error(`passkey_unrecorded ${JSON.stringify({ event: added ? 'added' : 'removed', userId: user.id })}`);
  }

  if (!added) {
    return;
  }

  const notice: PasskeyNotice = {
    id: user.id,
    acceptLanguage: context.headers?.get('accept-language') ?? null,
    email: user.email,
    userAgent: context.headers?.get('user-agent') ?? null
  };

  deps.background.run('passkey-mail', () => deps.mailPasskeyAdded(notice));
}
