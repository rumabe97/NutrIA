import { describe, expect, it } from '@jest/globals';

import { LOGGED_REQUEST_HEADERS, LOGGED_RESPONSE_HEADERS, serializeRequest, serializeResponse } from './pino.js';

/*
 * A production log line once carried a platform bearer credential valid for
 * hours, a proxy signature, and the caller's city, postal code and coordinates —
 * because the default records every header. These pin the allow-list: what is
 * named gets through, and nothing else does, whatever arrives upstream.
 */
describe('serializeRequest', () => {
  const headers = {
    'accept-language': 'es-ES',
    authorization: 'Bearer user-token',
    cookie: 'better-auth.session_token=secret',
    forwarded: 'for=104.28.88.137;sig=0QmVhcmVy',
    origin: 'https://nutr-ia-web-phi.vercel.app',
    'sec-fetch-site': 'cross-site',
    'user-agent': 'Mozilla/5.0 (iPhone)',
    'x-forwarded-for': '104.28.88.137',
    'x-vercel-id': 'cdg1::mfpq2',
    'x-vercel-ip-city': 'Zaragoza',
    'x-vercel-ip-latitude': '41.6579',
    'x-vercel-ip-postal-code': '50090',
    'x-vercel-oidc-token': 'eyJraWQiOi.platform.credential',
    'x-vercel-proxy-signature': 'Bearer 013954e1'
  };

  const line = serializeRequest({ id: 6, headers, method: 'GET', url: '/api/v1/profile' });

  it('keeps method, url and id', () => {
    expect(line).toMatchObject({ id: 6, method: 'GET', url: '/api/v1/profile' });
  });

  it('carries only the allowed headers, in the order named', () => {
    expect(Object.keys(line.headers as object)).toEqual(['accept-language', 'origin', 'sec-fetch-site', 'user-agent', 'x-vercel-id']);
  });

  it('drops the credentials the platform and the user send', () => {
    const logged = JSON.stringify(line);

    for (const secret of ['platform.credential', '013954e1', 'session_token', 'user-token', 'sig=']) {
      expect(logged).not.toContain(secret);
    }
  });

  it('drops the caller’s location and address', () => {
    const logged = JSON.stringify(line);

    for (const personal of ['Zaragoza', '41.6579', '50090', '104.28.88.137', 'remoteAddress']) {
      expect(logged).not.toContain(personal);
    }
  });

  it('never invents an allowed header that was not sent', () => {
    expect(serializeRequest({ headers: {}, method: 'GET', url: '/' }).headers).toEqual({});
  });

  it('never writes an invitation token, in the path or in the page that called it (0059)', () => {
    const token = 'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-abcde';
    const lines = [
      serializeRequest({ headers: {}, method: 'GET', url: `/api/v1/care/invitations/${token}` }),
      serializeRequest({ headers: {}, method: 'POST', url: `/api/v1/care/invitations/${token}/accept?x=1` }),
      serializeRequest({ headers: { referer: `https://nutria.example/en/invitacion/${token}#top` }, method: 'GET', url: '/api/v1/care/links/me' })
    ];

    for (const line of lines) {
      expect(JSON.stringify(line)).not.toContain(token);
    }

    expect(lines[1]?.url).toBe('/api/v1/care/invitations/[redacted]/accept?x=1');
    expect((lines[2]?.headers as { referer: string }).referer).toBe('https://nutria.example/en/invitacion/[redacted]#top');
    // The professional's own route carries no secret and is left as it is.
    expect(serializeRequest({ headers: {}, method: 'POST', url: '/api/v1/care/invitations' }).url).toBe('/api/v1/care/invitations');
  });

  it('never writes the token when the path travels percent-encoded, or in another case', () => {
    const token = 'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-abcde';
    const urls = [
      // A Better Auth callback carrying the page to come back to.
      `/api/v1/auth/sign-in/social?callbackURL=https%3A%2F%2Fnutria.example%2Fen%2Finvitacion%2F${token}&x=1`,
      `/api/v1/auth/callback/google?next=%2fen%2finvitacion%2f${token}`,
      `/api/v1/auth/verify?next=%252Fen%252Finvitacion%252F${token}%252F`,
      // Express routes these to the same handler.
      `/API/V1/CARE/INVITATIONS/${token}/accept`,
      `/api/v1/Care/Invitations/${token}`,
      // Express decodes `%41` into `A`: an encoded character is part of the token.
      `/api/v1/care/invitations/%41${token.slice(1)}/accept`
    ];

    for (const url of urls) {
      expect(serializeRequest({ headers: {}, method: 'GET', url }).url).not.toContain(token.slice(1));
    }

    const referer = `https://nutria.example/es/login?next=%2Fes%2FInvitacion%2F${token}`;

    expect(JSON.stringify(serializeRequest({ headers: { referer }, method: 'GET', url: '/' }))).not.toContain(token);
    expect(serializeRequest({ headers: {}, method: 'GET', url: urls[1] ?? '' }).url).toBe(
      '/api/v1/auth/callback/google?next=%2fen%2finvitacion%2f[redacted]'
    );
    expect(serializeRequest({ headers: {}, method: 'GET', url: urls[0] ?? '' }).url).toBe(
      '/api/v1/auth/sign-in/social?callbackURL=https%3A%2F%2Fnutria.example%2Fen%2Finvitacion%2F[redacted]&x=1'
    );
  });
});

describe('serializeResponse', () => {
  const line = serializeResponse({
    headers: {
      'content-security-policy': "default-src 'self'",
      'content-type': 'application/json; charset=utf-8',
      'set-cookie': ['better-auth.session_token=secret; HttpOnly'],
      'strict-transport-security': 'max-age=31536000',
      'x-vercel-internal-timing': 'bytecode-hit'
    },
    statusCode: 404
  });

  it('keeps the status and the content type, and drops the cookie and the noise', () => {
    expect(line).toEqual({ headers: { 'content-type': 'application/json; charset=utf-8' }, statusCode: 404 });
  });
});

describe('the allow-lists themselves', () => {
  it('name nothing that could carry a credential or a location', () => {
    for (const name of [...LOGGED_REQUEST_HEADERS, ...LOGGED_RESPONSE_HEADERS]) {
      expect(name).not.toMatch(/cookie|authorization|token|signature|forwarded|-ip-|real-ip/);
    }
  });
});
