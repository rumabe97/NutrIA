import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { enGB } from 'i18n/dictionaries/en-GB';
import { esES } from 'i18n/dictionaries/es-ES';
import { join } from 'node:path';
import { readdirSync, readFileSync } from 'node:fs';

import { LANDING_PICTURES, LANDING_PICTURES_MAX } from './landingPictures';
import { titleAccent } from './titleAccent';

describe('titleAccent', () => {
  it('splits a title around its own last words', () => {
    expect(titleAccent('Nutrición que se adapta a ti.', 'a ti.')).toEqual({ accent: 'a ti.', lead: 'Nutrición que se adapta ' });
  });

  it('draws the whole title plain when the accent is not its end', () => {
    expect(titleAccent('Nutrición que se adapta a ti.', 'a vosotros.')).toEqual({ accent: '', lead: 'Nutrición que se adapta a ti.' });
    expect(titleAccent('Nutrición', '')).toEqual({ accent: '', lead: 'Nutrición' });
    expect(titleAccent('a ti.', 'a ti.')).toEqual({ accent: '', lead: 'a ti.' });
  });
});

describe.each([
  ['es-ES', esES],
  ['en-GB', enGB]
])('the landing page in %s', (_, dictionary) => {
  it('accents words its title really ends with, so the heading reads as it always did', () => {
    const { accent, lead } = titleAccent(dictionary.landing.title, dictionary.landing.titleAccent);

    expect(accent).toBe(dictionary.landing.titleAccent);
    expect(`${lead}${accent}`).toBe(dictionary.landing.title);
  });

  it('never calls a generated picture a photograph (docs/legal/2026-11-11-redesign.md § 2.8 W2)', () => {
    expect(JSON.stringify(dictionary.landing)).not.toMatch(/\bfoto|fotograf|\bphoto/i);
  });
});

describe('the landing pictures', () => {
  it('are at most three, each an untouched absolute address with its recipe recorded', () => {
    expect(LANDING_PICTURES.length).toBeLessThanOrEqual(LANDING_PICTURES_MAX);

    for (const picture of LANDING_PICTURES) {
      expect(picture.path).toMatch(/^https:\/\//);
      expect(picture.recipeId).not.toBe('');
    }
  });
});

/**
 * The lighter copies a phone is given, checked in the committed files themselves
 * (`docs/legal/2026-11-13-lighter-landing-pictures.md`, M2, M3, M5–M7).
 */
describe("the landing pictures' lighter copies", () => {
  const folder = join(process.cwd(), 'public', 'landing');
  const AI_SOURCE = 'http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia';

  /** The JPEG's header segments, by marker, up to the start of the image data. */
  function segments(file: Buffer): number[] {
    const markers: number[] = [];

    for (let at = 2; at < file.length - 4 && file[at] === 0xff && file[at + 1] !== 0xda; at += 2 + file.readUInt16BE(at + 2)) {
      markers.push(file[at + 1]);
    }

    return markers;
  }

  it('are exactly the files the list names, one for each picture', () => {
    expect(readdirSync(folder).sort()).toEqual(LANDING_PICTURES.map(picture => `${picture.recipeId}.jpg`).sort());

    for (const picture of LANDING_PICTURES) {
      expect(picture.light.path).toBe(`/landing/${picture.recipeId}.jpg`);
      expect(picture.light.originalSha256).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it.each(LANDING_PICTURES.map(picture => [picture.recipeId, picture] as const))(
    '%s is the recorded file, says it was made by AI and carries no C2PA segment',
    (_id, picture) => {
      const file = readFileSync(join(folder, `${picture.recipeId}.jpg`));

      // M5: the bytes are the ones the owner checked for SynthID; a re-encode needs a new check.
      expect(createHash('sha256').update(file).digest('hex')).toBe(picture.light.sha256);
      expect(picture.light.sha256).not.toBe(picture.light.originalSha256);
      // M2: the IPTC source type, in the file's own XMP.
      expect(file.includes(Buffer.from(`Iptc4xmpExt:DigitalSourceType="${AI_SOURCE}"`))).toBe(true);
      // M3: no APP11 (JUMBF) segment and no C2PA label — a manifest that does not match reads as tampering.
      expect(segments(file)).not.toContain(0xeb);
      expect(file.includes(Buffer.from('c2pa'))).toBe(false);
      expect(file.includes(Buffer.from('jumb'))).toBe(false);
      // A phone's file: a fraction of the original's weight.
      expect(file.length).toBeLessThan(60_000);
    }
  );
});
