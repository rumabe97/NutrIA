import { renderToStaticMarkup } from 'react-dom/server';

import { describe, expect, it, vi } from 'vitest';
import { esES } from 'i18n/dictionaries/es-ES';
import { LocaleProvider } from 'i18n/LocaleProvider';

import { CareLinkCard } from './CareLinkCard';

import type { CareLinkView } from 'core/controllers/Care';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => undefined, refresh: () => undefined, replace: () => undefined }) }));

/** A link after a badge loss: consented to the plan-only list, health line off, widening on offer again. */
const PLAN: CareLinkView = {
  id: 'l1',
  consentIsCurrent: true,
  consentScope: 'plan',
  consentVersion: '2.0.0',
  professionalName: 'Ana Pérez',
  professionalVerified: true,
  reconsentOffered: true,
  scope: 'plan',
  shares: [],
  sharesHealth: false,
  sharesPlan: ['profile', 'plans', 'status'],
  since: '2026-11-01T00:00:00.000Z',
  status: 'active'
};

function card(link: CareLinkView): string {
  return renderToStaticMarkup(
    <LocaleProvider dictionary={esES} locale="es-ES">
      <CareLinkCard link={link} />
    </LocaleProvider>
  ).replace(/&#x27;|&#39;/g, "'");
}

describe('CareLinkCard under a plan scope', () => {
  it('names the plan-only list, never an empty "Comparte:"', () => {
    const markup = card(PLAN);

    expect(markup).toContain(esES.care.whatIsShared.replace('{list}', esES.care.sharesPlan.profile));
    expect(markup).toContain(esES.care.sharesPlan.status);
  });

  it('draws no health switch it could not turn on', () => {
    expect(card(PLAN)).not.toContain(esES.care.healthShareToggle);
  });

  it('keeps the switch while the line is on, so it can always be turned off', () => {
    expect(card({ ...PLAN, sharesHealth: true })).toContain(esES.care.healthShareToggle);
  });
});
