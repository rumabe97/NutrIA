import { createPrivateKey, sign } from 'node:crypto';

import type { Env } from '../../../config/index.js';

/** Every provider this service knows how to offer, in the order the buttons are drawn. */
export const SOCIAL_PROVIDER_IDS = ['google', 'apple'] as const;

export type SocialProviderId = (typeof SOCIAL_PROVIDER_IDS)[number];

type SocialEnv = Pick<
  Env,
  | 'APPLE_OAUTH_CLIENT_ID'
  | 'APPLE_OAUTH_KEY_ID'
  | 'APPLE_OAUTH_PRIVATE_KEY'
  | 'APPLE_OAUTH_TEAM_ID'
  | 'GOOGLE_OAUTH_CLIENT_ID'
  | 'GOOGLE_OAUTH_CLIENT_SECRET'
>;

/** Apple's form posts the person back from here, so Better Auth must accept it as an origin. */
export const APPLE_ORIGIN = 'https://appleid.apple.com';

const APPLE_AUDIENCE = 'https://appleid.apple.com';
const SECONDS_PER_DAY = 86_400;

/**
 * Apple refuses a client secret that lives longer than six months. This one is
 * signed when the process starts, so its lifetime only has to outlast a
 * process — and on a serverless host a process lives minutes, not months.
 */
const APPLE_SECRET_LIFETIME_DAYS = 150;

/**
 * Which providers the environment has the credentials for (`0058`).
 *
 * `Env.validation` already refused a half-configured provider at boot, so one
 * value per provider is enough to ask here. None — the shipped default — means
 * the sign-in page is the form it always was.
 */
export function configuredSocialProviders(env: SocialEnv): readonly SocialProviderId[] {
  const configured: Record<SocialProviderId, boolean> = { apple: Boolean(env.APPLE_OAUTH_CLIENT_ID), google: Boolean(env.GOOGLE_OAUTH_CLIENT_ID) };

  return SOCIAL_PROVIDER_IDS.filter(id => configured[id]);
}

function base64Url(value: Buffer | string): string {
  return Buffer.from(value).toString('base64url');
}

/**
 * Apple has no client secret to paste: it wants a JWT, signed with the key
 * downloaded once from the developer account, and it wants a new one at least
 * every six months. Signing it here, at boot, turns a calendar reminder that
 * ends in an outage into nothing at all.
 *
 * ES256 by hand rather than through a JWT library: it is one header, one
 * payload and one signature, and `node:crypto` signs P-256 in the raw
 * (`ieee-p1363`) form a JWT needs.
 */
export function appleClientSecret(
  credentials: { readonly clientId: string; readonly keyId: string; readonly privateKey: string; readonly teamId: string },
  now: Date = new Date()
): string {
  const issuedAt = Math.floor(now.getTime() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'ES256', kid: credentials.keyId, typ: 'JWT' }));
  const payload = base64Url(
    JSON.stringify({
      aud: APPLE_AUDIENCE,
      exp: issuedAt + APPLE_SECRET_LIFETIME_DAYS * SECONDS_PER_DAY,
      iat: issuedAt,
      iss: credentials.teamId,
      sub: credentials.clientId
    })
  );
  const signature = sign('sha256', Buffer.from(`${header}.${payload}`), { dsaEncoding: 'ieee-p1363', key: createPrivateKey(credentials.privateKey) });

  return `${header}.${payload}.${base64Url(signature)}`;
}

/**
 * Better Auth's `socialProviders`, built from whatever is configured.
 *
 * Only an identity is asked for — the default scopes, which are the address
 * and a name. No offline access and no provider API is ever called on
 * somebody's behalf, so there is nothing here worth a refresh token.
 */
export function socialProviderOptions(env: SocialEnv, now: Date = new Date()) {
  return {
    ...(env.GOOGLE_OAUTH_CLIENT_ID && env.GOOGLE_OAUTH_CLIENT_SECRET
      ? { google: { clientId: env.GOOGLE_OAUTH_CLIENT_ID, clientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET } }
      : {}),
    ...(env.APPLE_OAUTH_CLIENT_ID && env.APPLE_OAUTH_KEY_ID && env.APPLE_OAUTH_PRIVATE_KEY && env.APPLE_OAUTH_TEAM_ID
      ? {
          apple: {
            clientId: env.APPLE_OAUTH_CLIENT_ID,
            clientSecret: appleClientSecret(
              {
                clientId: env.APPLE_OAUTH_CLIENT_ID,
                keyId: env.APPLE_OAUTH_KEY_ID,
                privateKey: env.APPLE_OAUTH_PRIVATE_KEY,
                teamId: env.APPLE_OAUTH_TEAM_ID
              },
              now
            )
          }
        }
      : {})
  };
}
