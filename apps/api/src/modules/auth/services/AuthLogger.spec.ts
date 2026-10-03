import { describe, expect, it } from '@jest/globals';

import { withoutChallenges } from './AuthLogger.js';

describe('withoutChallenges', () => {
  it('replaces every quoted value on a line that names a challenge — the one sent and the one expected', () => {
    const line = withoutChallenges('Error: Unexpected authentication response challenge "c2VudA", expected "b3Vycw"\n    at verify (x.js:1:1)');

    expect(line).toBe('Error: Unexpected authentication response challenge "[redacted]", expected "[redacted]"\n    at verify (x.js:1:1)');
  });

  it('leaves a line that names no challenge as it was', () => {
    expect(withoutChallenges('Unexpected registration response origin "https://a.example", expected "https://b.example"')).toBe(
      'Unexpected registration response origin "https://a.example", expected "https://b.example"'
    );
  });
});
