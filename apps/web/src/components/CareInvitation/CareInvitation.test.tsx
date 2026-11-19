import { renderToStaticMarkup } from 'react-dom/server';

import { describe, expect, it, vi } from 'vitest';
import { enGB } from 'i18n/dictionaries/en-GB';
import { esES } from 'i18n/dictionaries/es-ES';
import { LocaleProvider } from 'i18n/LocaleProvider';

import { CareInvitation } from './CareInvitation';

import type { CareInvitationDetailView } from 'core/controllers/Care';
import type { Locale } from 'i18n/config';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => undefined, refresh: () => undefined, replace: () => undefined }) }));

const COMMON = { consentVersion: '2.0.0', expiresAt: '2026-12-01T00:00:00.000Z', professionalName: 'Ana Pérez' };

/** The badged invitation, as `presentInvitationDetail` answers it. */
const FULL: CareInvitationDetailView = {
  ...COMMON,
  badge: { checkedAt: '2026-11-01T00:00:00.000Z', collegiateNumber: 'AND-123' },
  collegiateNumber: 'AND-123',
  healthShares: ['conditions', 'medications', 'supplements'],
  scope: 'full',
  shares: ['profile', 'targets', 'mealPlans', 'progress', 'checkIns'],
  sharesPlan: []
};

/** Without the badge: the plan-only list, no number, no health line. */
const PLAN: CareInvitationDetailView = {
  ...COMMON,
  badge: null,
  collegiateNumber: '',
  healthShares: [],
  scope: 'plan',
  shares: [],
  sharesPlan: ['profile', 'plans', 'status']
};

/** The markup with its entities back, so a sentence with an apostrophe compares as written. */
function page(invitation: CareInvitationDetailView, dictionary: typeof esES = esES, locale: Locale = 'es-ES'): string {
  const markup = renderToStaticMarkup(
    <LocaleProvider dictionary={dictionary} locale={locale}>
      <CareInvitation invitation={invitation} token="token" />
    </LocaleProvider>
  );

  return markup
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&');
}

describe('CareInvitation without the badge', () => {
  it.each([
    ['es-ES', esES],
    ['en-GB', enGB]
  ] as const)('draws no empty number, the plan-only list and no health question (%s)', (locale, dictionary) => {
    const markup = page(PLAN, dictionary, locale);

    expect(markup).toContain(dictionary.care.invitationIntroPlan.replace('{professional}', 'Ana Pérez'));
    expect(markup).not.toContain(dictionary.care.invitationIntro.split('{collegiateNumber}')[0].replace('{professional}', 'Ana Pérez'));

    for (const share of PLAN.sharesPlan) {
      expect(markup).toContain(dictionary.care.sharesPlan[share]);
    }

    expect(markup).not.toContain(dictionary.care.healthQuestion);
    expect(markup).not.toContain(dictionary.care.canDo.targets);
    expect(markup).not.toMatch(/<ul[^>]*><\/ul>/);
  });
});

describe('CareInvitation with the badge', () => {
  it('keeps the number, the badged list and the health question', () => {
    const markup = page(FULL);

    expect(markup).toContain('AND-123');
    expect(markup).toContain(esES.care.shares.targets);
    expect(markup).toContain(esES.care.healthQuestion);
    expect(markup).not.toContain(esES.care.sharesPlan.status);
  });
});
