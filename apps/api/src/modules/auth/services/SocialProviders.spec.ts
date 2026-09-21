import { createPublicKey, generateKeyPairSync, verify } from 'node:crypto';

import { describe, expect, it } from '@jest/globals';

import { appleClientSecret, configuredSocialProviders, socialProviderOptions } from './SocialProviders.js';

/** A throwaway P-256 pair, made per run: what Apple's `.p8` holds, and nothing anybody could use. */
const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const PEM = privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();

const NONE = {
  APPLE_OAUTH_CLIENT_ID: undefined,
  APPLE_OAUTH_KEY_ID: undefined,
  APPLE_OAUTH_PRIVATE_KEY: undefined,
  APPLE_OAUTH_TEAM_ID: undefined,
  GOOGLE_OAUTH_CLIENT_ID: undefined,
  GOOGLE_OAUTH_CLIENT_SECRET: undefined
};
const GOOGLE = { GOOGLE_OAUTH_CLIENT_ID: 'nutria.apps.googleusercontent.com', GOOGLE_OAUTH_CLIENT_SECRET: 'not-a-real-secret' };
const APPLE = {
  APPLE_OAUTH_CLIENT_ID: 'app.nutria.web',
  APPLE_OAUTH_KEY_ID: 'ABCDEFGHIJ',
  APPLE_OAUTH_PRIVATE_KEY: PEM,
  APPLE_OAUTH_TEAM_ID: 'KLMNOPQRST'
};

function decode(part: string | undefined): Record<string, unknown> {
  return JSON.parse(Buffer.from(part ?? '', 'base64url').toString()) as Record<string, unknown>;
}

describe('configuredSocialProviders', () => {
  it('offers nothing when nothing is configured, which is how it ships', () => {
    expect(configuredSocialProviders(NONE)).toEqual([]);
    expect(socialProviderOptions(NONE)).toEqual({});
  });

  it('offers exactly what has credentials, in the order the buttons are drawn', () => {
    expect(configuredSocialProviders({ ...NONE, ...GOOGLE })).toEqual(['google']);
    expect(configuredSocialProviders({ ...NONE, ...APPLE })).toEqual(['apple']);
    expect(configuredSocialProviders({ ...NONE, ...APPLE, ...GOOGLE })).toEqual(['google', 'apple']);
  });

  it('hands Better Auth the pair Google issued, untouched', () => {
    expect(socialProviderOptions({ ...NONE, ...GOOGLE })).toEqual({
      google: { clientId: GOOGLE.GOOGLE_OAUTH_CLIENT_ID, clientSecret: GOOGLE.GOOGLE_OAUTH_CLIENT_SECRET }
    });
  });
});

describe('appleClientSecret', () => {
  const now = new Date('2026-09-21T10:00:00Z');
  const secret = appleClientSecret({ clientId: 'app.nutria.web', keyId: 'ABCDEFGHIJ', privateKey: PEM, teamId: 'KLMNOPQRST' }, now);
  const [header, payload, signature] = secret.split('.');

  it('is the JWT Apple asks for: ES256, the key named, the team as issuer, the services id as subject', () => {
    expect(decode(header)).toEqual({ alg: 'ES256', kid: 'ABCDEFGHIJ', typ: 'JWT' });
    expect(decode(payload)).toMatchObject({ aud: 'https://appleid.apple.com', iss: 'KLMNOPQRST', sub: 'app.nutria.web' });
  });

  it('expires inside the six months Apple allows, and well after any process that signed it', () => {
    const { exp, iat } = decode(payload) as { exp: number; iat: number };
    const sixMonths = 15_777_000;

    expect(iat).toBe(Math.floor(now.getTime() / 1000));
    expect(exp - iat).toBeLessThan(sixMonths);
    expect(exp - iat).toBeGreaterThan(sixMonths / 2);
  });

  it('is signed by the key it was given, in the raw form a JWT carries', () => {
    const valid = verify(
      'sha256',
      Buffer.from(`${header}.${payload}`),
      { dsaEncoding: 'ieee-p1363', key: createPublicKey(publicKey.export({ format: 'pem', type: 'spki' }).toString()) },
      Buffer.from(signature ?? '', 'base64url')
    );

    expect(valid).toBe(true);
  });

  it('reaches Better Auth as the client secret when Apple is configured', () => {
    const options = socialProviderOptions({ ...NONE, ...APPLE }, now);

    // An ECDSA signature is salted, so two secrets for one instant differ in
    // their last part and in nothing else.
    expect(options.apple?.clientId).toBe('app.nutria.web');
    expect(options.apple?.clientSecret.split('.').slice(0, 2)).toEqual([header, payload]);
  });
});
