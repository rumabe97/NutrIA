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

  it('says nobody sees a line left on under a plan-only link', () => {
    const markup = card({ ...PLAN, sharesHealth: true });

    expect(markup).not.toContain(esES.care.healthShareOnHint.replace('{professional}', 'Ana Pérez'));
  });
});

describe('CareLinkCard in the words of consent 3.0.0 (textos/05 §§ F.1, F.4)', () => {
  it('is «Tu profesional» whatever the tier, never «dietista»', () => {
    const markup = card({ ...PLAN, reconsentOffered: false });

    expect(markup).toContain(esES.care.linkTitle);
    expect(markup.toLowerCase()).not.toContain('dietista');
  });

  it('offers the badged list while a badge stands on a plan-only link', () => {
    const markup = card(PLAN);

    expect(markup).toContain(esES.care.reconsentTitle.replace('{professional}', 'Ana Pérez'));
    expect(markup).toContain(esES.care.reconsentAccept);
    expect(markup).toContain(esES.care.reconsentLater);
    expect(markup).toContain(esES.care.shares.targets);
    expect(markup).toContain(esES.care.healthQuestion);
  });

  it('draws no offer once it is not on offer', () => {
    expect(card({ ...PLAN, reconsentOffered: false })).not.toContain(esES.care.reconsentAccept);
  });

  it('shows the fixed notice under the name of a practitioner without the badge', () => {
    expect(card({ ...PLAN, professionalVerified: false, reconsentOffered: false })).toContain(esES.care.invitationNotice);
    expect(card(PLAN)).not.toContain(esES.care.invitationNotice);
  });

  it('says «tu profesional» when the name may not be shown', () => {
    expect(card({ ...PLAN, professionalName: null })).toContain('Tu profesional ahora tiene la verificación de NutrIA');
  });

  it('names the practitioner in the health hints of a full link', () => {
    const markup = card({
      ...PLAN,
      consentScope: 'full',
      reconsentOffered: false,
      scope: 'full',
      shares: ['profile'],
      sharesHealth: true,
      sharesPlan: []
    });

    expect(markup).toContain(esES.care.healthShareOnHint.replace('{professional}', 'Ana Pérez'));
  });
});
