import { describe, expect, it } from 'vitest';

import { enGB } from './dictionaries/en-GB';
import { esES } from './dictionaries/es-ES';
import { interpolate } from './interpolate';
import { LEGAL_IDENTITY } from './legalIdentity';

const DOCUMENTS = [esES.privacy, esES.terms, enGB.privacy, enGB.terms];

function everyString(document: (typeof DOCUMENTS)[number]): string[] {
  return [...document.intro, ...document.sections.flatMap(section => [section.heading, ...section.paragraphs, ...(section.list ?? [])])];
}

/**
 * The privacy policy and the terms must say who answers for the service, and
 * the repository must not (`scripts/check-leaks.sh`). So the documents carry
 * placeholders, and one excepted file fills them in.
 */
describe('legal documents', () => {
  it('name the person who answers for the service once filled in, in both languages', () => {
    for (const document of DOCUMENTS) {
      const text = everyString(document)
        .map(line => interpolate(line, LEGAL_IDENTITY))
        .join('\n');

      expect(text).toContain(LEGAL_IDENTITY.name);
      expect(text).toContain(LEGAL_IDENTITY.email);
      expect(text).not.toMatch(/\{\w+\}/);
    }
  });

  it('never name them in the dictionary itself', () => {
    for (const document of DOCUMENTS) {
      const raw = everyString(document).join('\n');

      expect(raw).not.toContain(LEGAL_IDENTITY.name);
      expect(raw).not.toContain('@');
    }
  });

  it('have the same sections in both languages', () => {
    expect(enGB.privacy.sections).toHaveLength(esES.privacy.sections.length);
    expect(enGB.terms.sections).toHaveLength(esES.terms.sections.length);
  });
});
