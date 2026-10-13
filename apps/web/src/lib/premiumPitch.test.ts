import { describe, expect, it } from 'vitest';

import { enGB } from '../i18n/dictionaries/en-GB';
import { esES } from '../i18n/dictionaries/es-ES';
import { pitchValues, premiumPitch } from './premiumPitch';

import type { PitchAllowances } from './premiumPitch';

const ALLOWANCES: PitchAllowances = {
  free: { eventsPerPlan: 3, fixedMeals: 1, mealSwapsPerPlan: 5, midPlanEventsPerPlan: 0, planRedosPerFortnight: 1 },
  premium: { eventsPerPlan: 7, fixedMeals: 3, mealSwapsPerPlan: 20, midPlanEventsPerPlan: 3, planRedosPerFortnight: 3 }
};

const PITCHES = [
  ['es-ES', esES.profile.premiumPitch],
  ['en-GB', enGB.profile.premiumPitch]
] as const;

function placeholders(template: string): string[] {
  return [...template.matchAll(/\{(\w+)\}/g)].map(([, name]) => name as string);
}

describe('the premium pitch', () => {
  /*
   * The defect this exists for: the sentence promised "diez eventos" on the page
   * that asks for money, for three weeks after `0044`'s rule stopped allowing
   * more than seven. The number was a word in a dictionary, so nothing could
   * have caught it. Now every figure is a placeholder, and a placeholder nobody
   * fills is rendered literally — which is better than a wrong number and still
   * not good enough to ship.
   */
  it.each(PITCHES)('fills every placeholder %s writes', (_locale, template) => {
    const supplied = Object.keys(pitchValues(ALLOWANCES));

    expect(placeholders(template).length).toBeGreaterThan(0);

    for (const name of placeholders(template)) {
      expect(supplied, name).toContain(name);
    }

    expect(premiumPitch(template, ALLOWANCES)).not.toMatch(/\{\w+\}/);
  });

  it.each(PITCHES)('names the numbers it was given, in %s', (_locale, template) => {
    const line = premiumPitch(template, ALLOWANCES);

    // The pair that is the whole of the pitch: what premium gives against what
    // free already gives. A sentence that named only one of the two would read
    // as true and sell nothing.
    for (const figure of [7, 20, 3, 1, 5]) {
      expect(line).toContain(String(figure));
    }

    expect(line).not.toContain('undefined');
  });

  /*
   * The console may move any of these without a deploy (`0097`), so the sentence
   * has to follow the console rather than the shipped table.
   */
  it('follows a limit the console has moved', () => {
    const moved: PitchAllowances = { ...ALLOWANCES, premium: { ...ALLOWANCES.premium, mealSwapsPerPlan: 28 } };

    expect(premiumPitch(esES.profile.premiumPitch, moved)).toContain('28');
    expect(premiumPitch(esES.profile.premiumPitch, moved)).not.toContain('20 cambios');
  });

  /* Both languages say the same thing about the same numbers, or one of them is lying. */
  it('writes the same placeholders in both languages', () => {
    expect(placeholders(esES.profile.premiumPitch).sort()).toEqual(placeholders(enGB.profile.premiumPitch).sort());
  });
});
