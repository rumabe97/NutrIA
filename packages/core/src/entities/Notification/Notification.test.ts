import { describe, expect, it } from 'vitest';

import { pushSubscriptionSchema } from 'core/entities/Notification';

const KEYS = { auth: 'tBHItJI5svbpez7KI4CCXg', p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM' };

function accepts(endpoint: string): boolean {
  return pushSubscriptionSchema.safeParse({ endpoint, keys: KEYS }).success;
}

describe('pushSubscriptionSchema', () => {
  it('accepts the push services browsers use', () => {
    expect(accepts('https://fcm.googleapis.com/fcm/send/abc123')).toBe(true);
    expect(accepts('https://web.push.apple.com/QGuQyavXutnMH')).toBe(true);
    expect(accepts('https://updates.push.services.mozilla.com/wpush/v2/gAAAA')).toBe(true);
    expect(accepts('https://wns2-par02p.notify.windows.com/w/?token=BQYAAA')).toBe(true);
  });

  /* The server POSTs to whatever is stored: anything else would let a caller aim it. */
  it('refuses an endpoint anywhere else', () => {
    expect(accepts('https://169.254.169.254/latest/meta-data')).toBe(false);
    expect(accepts('https://localhost:3001/api/v1/admin')).toBe(false);
    expect(accepts('https://fcm.googleapis.com.evil.example/send')).toBe(false);
    expect(accepts('https://evilpush.apple.com.example/x')).toBe(false);
    expect(accepts('http://fcm.googleapis.com/fcm/send/abc123')).toBe(false);
  });

  it('refuses keys that are not base64url', () => {
    expect(
      pushSubscriptionSchema.safeParse({ endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { ...KEYS, auth: 'not a key!' } }).success
    ).toBe(false);
  });
});
