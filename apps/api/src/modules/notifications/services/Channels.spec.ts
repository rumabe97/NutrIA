import { describe, expect, it } from '@jest/globals';

import { channelsReached } from './Channels.js';

describe('channelsReached', () => {
  it('says both when the mail and a phone both took it', () => {
    expect(channelsReached(true, 2)).toEqual(['email', 'push']);
  });

  it('says only the one that took it', () => {
    expect(channelsReached(true, 0)).toEqual(['email']);
    expect(channelsReached(false, 1)).toEqual(['push']);
  });

  it('says nothing reached them when nothing did', () => {
    expect(channelsReached(false, 0)).toBeNull();
  });
});
