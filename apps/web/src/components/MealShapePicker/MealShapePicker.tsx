import styles from './MealShapePicker.module.css';

import type { MealShape, MealSize } from 'core/entities/Profile';

const SLOTS = ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner', 'supper'] as const;
const SIZES = ['off', 'light', 'normal', 'large'] as const;

interface MealShapePickerProps {
  /** Copy, so this stays a server component and the dictionary keeps living in one place. */
  labels: { sizes: Record<MealSize, string>; slots: Record<(typeof SLOTS)[number], string> };
  value: MealShape;
}

/**
 * Which meals somebody eats, and how big each one is (`0036`).
 *
 * Radios, not a slider and not a set of percentages. "How much of your day is
 * breakfast" is a question about arithmetic that nobody can answer honestly;
 * "do you eat breakfast, and is it small" is a question about breakfast. The
 * four answers become weights further down, where the scheduler already knows
 * how to divide a day by them.
 *
 * Plain form fields, because the step around it is a plain form: one radio group
 * per slot, named for the slot, so the whole shape arrives in one submit with no
 * state to get out of step with what is on screen.
 */
export function MealShapePicker({ labels, value }: MealShapePickerProps) {
  return (
    <div className={styles.picker}>
      {SLOTS.map(slot => (
        <fieldset className={styles.row} key={slot}>
          <legend className={styles.slot}>{labels.slots[slot]}</legend>
          <div className={styles.sizes}>
            {SIZES.map(size => (
              <label className={styles.size} key={size}>
                <input defaultChecked={value[slot] === size} name={`shape.${slot}`} type="radio" value={size} />
                <span className={styles.pill}>{labels.sizes[size]}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
