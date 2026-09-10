import { describe, expect, it } from 'vitest';

import { fallbackFlags, FLAG_NAMES, FLAGS, flagsFor, flagsFrom } from 'core/domain/Flag';

describe('flagsFrom', () => {
  it('gives every flag its declared fallback when the table is empty', () => {
    expect(flagsFrom([])).toEqual({ automaticActivation: true, premium: false });
  });

  it('lets a stored row override the fallback, in both directions', () => {
    expect(flagsFrom([{ enabled: false, key: 'automatic_activation' }])).toMatchObject({ automaticActivation: false });
    expect(flagsFrom([{ enabled: true, key: 'premium' }])).toMatchObject({ premium: true });
  });

  /*
   * A flag deleted from the registry leaves its row behind. Refusing to read
   * the table because of it would turn tidying up into an outage.
   */
  it('ignores a row for a key nobody declares any more', () => {
    expect(flagsFrom([{ enabled: true, key: 'a_switch_that_was_removed' }])).toEqual(fallbackFlags());
  });

  it('reads each flag from its own row, not by position', () => {
    expect(
      flagsFrom([
        { enabled: true, key: 'premium' },
        { enabled: false, key: 'automatic_activation' }
      ])
    ).toEqual({ automaticActivation: false, premium: true });
  });
});

describe('flagsFor', () => {
  it('gives the owner everything', () => {
    expect(flagsFor(fallbackFlags(), 'owner')).toEqual(fallbackFlags());
  });

  it('gives a signed-in reader only the flags declared for them', () => {
    const visible = flagsFor(fallbackFlags(), 'signed-in');

    for (const name of FLAG_NAMES) {
      expect(name in visible).toBe(FLAGS[name].audience === 'signed-in');
    }
  });
});

describe('the registry itself', () => {
  /* Two flags on one key would make the second silently shadow the first. */
  it('gives every flag its own row', () => {
    const keys = FLAG_NAMES.map(name => FLAGS[name].key);

    expect(new Set(keys).size).toBe(keys.length);
  });

  /*
   * A missing row must never be what turns on something that costs money or
   * raises what an account may spend. `automaticActivation` is the deliberate
   * exception and argues for itself in the registry.
   */
  it('leaves the paid tier off until somebody says otherwise', () => {
    expect(FLAGS.premium.fallback).toBe(false);
  });
});
