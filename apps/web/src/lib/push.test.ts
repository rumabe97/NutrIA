import { describe, expect, it } from 'vitest';

import { applicationServerKey } from './push';

describe('applicationServerKey', () => {
  /* What `npx web-push generate-vapid-keys` prints is base64url; a subscription wants the raw point. */
  it('turns a base64url public key into the 65 bytes of an uncompressed P-256 point', () => {
    const key = applicationServerKey('BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM');

    expect(key).toHaveLength(65);
    expect(key[0]).toBe(4);
  });
});
