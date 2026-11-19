import { renderToStaticMarkup } from 'react-dom/server';

import { describe, expect, it, vi } from 'vitest';
import { esES } from 'i18n/dictionaries/es-ES';
import { LocaleProvider } from 'i18n/LocaleProvider';

import { PracticeProfileForm } from './PracticeProfileForm';

import type { ProfessionalProfileView } from 'core/controllers/Professional';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => undefined, refresh: () => undefined, replace: () => undefined }) }));

const PROFILE: ProfessionalProfileView = {
  displayName: 'Marta Ruiz',
  hidden: null,
  hours: [[{ from: '09:00', to: '14:00' }], [], [], [], [], [], []],
  priceCents: 3050,
  priceUnit: 'consultation',
  review: 'queued',
  studies: 'Grado en Nutrición Humana y Dietética',
  updatedAt: '2026-11-18T00:00:00Z',
  withheld: []
};

function page(profile: ProfessionalProfileView | null): string {
  return renderToStaticMarkup(
    <LocaleProvider dictionary={esES} locale="es-ES">
      <PracticeProfileForm profile={profile} />
    </LocaleProvider>
  );
}

const t = esES.practice;

describe('PracticeProfileForm (textos/01 § P4)', () => {
  it('draws every field in its approved label, the price and its unit, and a closed day', () => {
    const markup = page(PROFILE);

    for (const label of [
      t.profileName,
      t.profileStudies,
      t.profileStudiesNote,
      t.profilePrice,
      t.profilePriceNote,
      t.profileHours,
      t.profileHoursNote
    ]) {
      expect(markup).toContain(label);
    }

    expect(markup).toContain('30,50');
    // Radix's Select draws its chosen value after hydration; its label is in the first paint.
    expect(markup).toContain(t.profilePriceUnitLabel);
    expect(markup).toContain(t.profileHoursClosed);
    expect(markup).toContain('value="09:00"');
  });

  it('starts empty before the first save, every day closed', () => {
    const markup = page(null);

    expect(markup.split(t.profileHoursClosed)).toHaveLength(8);
  });

  it('says on the field why a withheld word is no longer shown', () => {
    const markup = page({ ...PROFILE, withheld: [{ field: 'studies', list: 'badge_only', word: 'nutricion humana y dietetica' }] });

    expect(markup).toContain(t.profileWordRefused.replace('{word}', 'nutricion humana y dietetica'));
    expect(markup).toContain('aria-invalid="true"');
  });
});
