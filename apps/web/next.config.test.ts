import { describe, expect, it } from 'vitest';

import nextConfig from './next.config.js';

/**
 * What the app *sends*, as opposed to what the policy says (`csp.test.ts`): the header's name is the
 * whole difference between a policy that blocks and one that only reports, and nothing else would
 * notice if it went back.
 */
describe('next.config headers', () => {
  const keys = async () => {
    // `headers` is optional on `NextConfig`, and a config that sends none would pass every
    // assertion below by returning an empty list. So the absence is the first failure.
    if (!nextConfig.headers) {
      throw new Error('next.config.js sends no headers at all');
    }

    const entries = (await nextConfig.headers()) as { headers: { key: string; value: string }[] }[];

    return entries.flatMap(entry => entry.headers.map(header => header.key));
  };

  it('sends the policy enforcing', async () => {
    expect(await keys()).toContain('Content-Security-Policy');
  });

  it('sends no report-only policy beside it', async () => {
    expect((await keys()).filter(key => key.endsWith('-Report-Only'))).toEqual([]);
  });

  it.each(['X-Frame-Options', 'X-Content-Type-Options', 'Referrer-Policy', 'Permissions-Policy'])('still sends %s', async name => {
    expect(await keys()).toContain(name);
  });
});
