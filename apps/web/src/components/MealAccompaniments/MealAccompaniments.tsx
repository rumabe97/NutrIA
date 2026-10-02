import { Fragment } from 'react';

import styles from './MealAccompaniments.module.css';

import { Text } from 'ui/components/Text';

import { accompanimentAdds, accompanimentIsSingle, accompanimentTitle } from 'lib/accompaniments';
import { formatNumber, formatQuantity, interpolate } from 'lib/format';

import type { Dictionary } from '../../i18n/dictionaries/es-ES';
import type { Locale } from '../../i18n/config';
import type { MealAccompaniment } from 'lib/accompaniments';

const NO_BREAK_SPACE = ' ';

interface MealAccompanimentsProps {
  dictionary: Dictionary;
  locale: Locale;
  /** The whole meal's energy, the plate and its sides: what their share is a share of. */
  mealKcal: number;
  sides: readonly MealAccompaniment[];
}

/**
 * What goes beside the plate (`0079`): one block per side, its own ingredients
 * and what it adds to the meal's energy. The dish's ingredients above stay the
 * dish's; shopping and cooking read these separately, because bread is not
 * cooked and a salad is not part of the recipe.
 */
export function MealAccompaniments({ dictionary, locale, mealKcal, sides }: MealAccompanimentsProps) {
  if (sides.length === 0) {
    return null;
  }

  const added = sides.reduce((total, side) => total + side.kcal, 0);
  const percent = mealKcal > 0 ? Math.round((added / mealKcal) * 100) : 0;

  return (
    <section className={styles.section}>
      <h2 className={styles.title}>{dictionary.meal.accompanimentsTitle}</h2>

      <div className={styles.share}>
        <Text size="sm">
          {interpolate(dictionary.meal.accompanimentsShare, {
            kcal: formatNumber(Math.round(added), locale),
            percent: formatNumber(percent, locale)
          })}
        </Text>
      </div>

      <ul className={styles.sides} role="list">
        {sides.map(side => {
          // A lone food is its heading; its weight moves to the heading's line.
          const single = accompanimentIsSingle(side);

          return (
            <li className={styles.side} key={side.key}>
              <div className={styles.head}>
                <h3 className={styles.name}>{accompanimentTitle(side, dictionary, locale)}</h3>
                <span className={styles.kcal}>{accompanimentAdds(side, dictionary, locale)}</span>
              </div>
              {single ? null : (
                <ul className={styles.ingredients} role="list">
                  {side.ingredients.map(ingredient => (
                    <li className={styles.ingredient} key={ingredient.name}>
                      {/* Plain rice is weighed dry in the kitchen, like a dish's grains. */}
                      {ingredient.dry ? (
                        <span className={styles.ingredientName}>
                          {interpolate(dictionary.meal.dryLine, {
                            dry: formatQuantity(ingredient.dry.grams, 'g', locale, dictionary).replace(' ', NO_BREAK_SPACE),
                            name: ingredient.dry.name
                          })}{' '}
                          <span className={styles.cooked}>
                            {interpolate(dictionary.meal.cookedNote, { cooked: formatQuantity(ingredient.grams, 'g', locale, dictionary) })}
                          </span>
                        </span>
                      ) : (
                        <Fragment>
                          <span className={styles.ingredientName}>{ingredient.name}</span>
                          <span className={styles.quantity}>{formatQuantity(ingredient.grams, 'g', locale, dictionary)}</span>
                        </Fragment>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
