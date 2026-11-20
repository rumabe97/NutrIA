import { renderToStaticMarkup } from 'react-dom/server';

import { describe, expect, it } from 'vitest';
import { enGB } from 'i18n/dictionaries/en-GB';

import { plainText } from 'lib/ownerFacts';
import { restrictionStatement } from 'lib/ownerStatements';

import { OwnerFacts } from './OwnerFacts';

describe('OwnerFacts', () => {
  it('marks the facts and an authority’s name as Spanish on an English page', () => {
    const why = restrictionStatement(enGB, { authority: 'la AEPD', clause: null, facts: 'Hechos del caso', source: 'authority' });
    const markup = renderToStaticMarkup(<OwnerFacts value={why} />);

    expect(markup).toContain('<span lang="es">Hechos del caso.</span>');
    expect(markup).toContain('<span lang="es">la AEPD</span> requires it of us.');
    expect(markup.replace(/<[^>]+>/g, '').replaceAll('&#x27;', "'")).toBe(plainText(why));
  });

  it('marks the authority when no facts are typed yet, and never shows the placeholder', () => {
    const why = restrictionStatement(enGB, { authority: 'la AEPD', clause: null, facts: '', source: 'authority' });
    const markup = renderToStaticMarkup(<OwnerFacts value={why} />);

    expect(markup).toContain('<span lang="es">la AEPD</span>');
    expect(markup).not.toContain('{authority}');
  });
});
