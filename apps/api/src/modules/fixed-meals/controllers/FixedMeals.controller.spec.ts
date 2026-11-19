import { describe, expect, it, jest } from '@jest/globals';

import { InputParseError } from 'core/entities/Error';

import { FixedMealsController } from './FixedMeals.controller.js';

import type { FixedMealsService } from '../services/index.js';
import type { SessionUser } from '../../../shared/index.js';

/*
 * `GET /fixed-meals/fixable` reads its two values from the query string, so
 * each may be missing or anything at all. Found by the route walk of project
 * 025 phase 7: a missing or malformed weekday reached the filter as a schema's
 * own error — a 500 — where the slot beside it was already a 422.
 */

const USER = { id: 'usr-1' } as SessionUser;

function controller() {
  const fixable = jest.fn<FixedMealsService['fixable']>().mockResolvedValue([]);

  return { controller: new FixedMealsController({ fixable } as unknown as FixedMealsService), fixable };
}

describe('FixedMealsController.fixable — the query string is the person’s input', () => {
  it.each([undefined, '', ' ', 'lunes', '7', '-1', '1.5', 'NaN', '1e0x'])(
    'refuses the weekday %p as input, and asks the service nothing',
    async weekday => {
      const { controller: subject, fixable } = controller();

      await expect(subject.fixable(USER, weekday as string, 'lunch')).rejects.toBeInstanceOf(InputParseError);
      await expect(subject.fixable(USER, weekday as string, 'lunch')).rejects.toMatchObject({ fieldErrors: { weekday: [expect.any(String)] } });
      expect(fixable).not.toHaveBeenCalled();
    }
  );

  it.each([undefined, '', 'brunch'])('refuses the slot %p as input', async slot => {
    const { controller: subject, fixable } = controller();

    await expect(subject.fixable(USER, '1', slot as string)).rejects.toBeInstanceOf(InputParseError);
    expect(fixable).not.toHaveBeenCalled();
  });

  it.each(['0', '6', ' 3 '])('takes the weekday %p', async weekday => {
    const { controller: subject, fixable } = controller();

    await expect(subject.fixable(USER, weekday, 'lunch')).resolves.toEqual([]);
    expect(fixable.mock.calls).toEqual([['usr-1', Number(weekday), 'lunch']]);
  });
});
