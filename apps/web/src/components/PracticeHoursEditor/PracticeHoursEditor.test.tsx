import { renderToStaticMarkup } from 'react-dom/server';

import { describe, expect, it } from 'vitest';
import { enGB } from 'i18n/dictionaries/en-GB';
import { esES } from 'i18n/dictionaries/es-ES';
import { LocaleProvider } from 'i18n/LocaleProvider';

import { PracticeHoursEditor } from './PracticeHoursEditor';

import type { HoursRange } from './PracticeHoursEditor';

const RANGE = { from: '09:00', to: '14:00' };

function page(hours: HoursRange[][], errorDay: number | null = null, error?: string, dictionary = esES): string {
  return renderToStaticMarkup(
    <LocaleProvider dictionary={dictionary} locale={dictionary === esES ? 'es-ES' : 'en-GB'}>
      <PracticeHoursEditor error={error} errorDay={errorDay} hours={hours} onChange={() => undefined} />
    </LocaleProvider>
  );
}

describe('PracticeHoursEditor (accessibility review, phase 8)', () => {
  it('names each range by its day and place, and says which one each «Quitar» removes', () => {
    const markup = page([[RANGE, RANGE], [], [], [], [], [], []]);

    expect(markup).toContain('<legend class="visually-hidden">Lunes, horario 2</legend>');
    expect(markup).toContain(`${esES.practice.profileHoursRemove}<span class="visually-hidden"> (Lunes, horario 2)</span>`);
  });

  it('keeps «Añadir» in place at six ranges, unpressable, with the limit beside it', () => {
    const markup = page([Array.from({ length: 6 }, () => RANGE), [], [], [], [], [], []], null, undefined, enGB);

    expect(markup).toMatch(/aria-disabled="true"[^>]*aria-label="Add hours on Monday"|aria-label="Add hours on Monday"[^>]*aria-disabled="true"/);
    expect(markup).toContain(enGB.practice.profileHoursFull.replace('{max}', '6'));
  });

  it('marks the refused day’s fields and ties them to the sentence that names it', () => {
    const markup = page([[RANGE], [], [], [], [], [], []], 0, 'Revisa el horario del lunes.');

    expect(markup.match(/aria-invalid="true"/g)).toHaveLength(2);
    expect(markup).toContain('Revisa el horario del lunes.');
  });
});
