import styles from './MealEquipment.module.css';

import { ApplianceIcon } from 'components/ApplianceIcon';

import type { Appliance } from 'core/entities/Kitchen';
import type { Dictionary } from 'i18n/dictionaries/es-ES';

interface MealEquipmentProps {
  /** Copy, so this stays a server component and the dictionary keeps living in one place. */
  dictionary: Dictionary;
  /** What the dish declares it cannot be cooked without (`0102`). */
  equipment: readonly Appliance[];
}

/**
 * What this dish is cooked with, before anybody starts cooking it.
 *
 * **A hob is not news.** Every dish the migration could not classify declares
 * one, and 873 of the library's dishes declare it and nothing else, so a chip
 * saying "fuego" on nearly every plate would be noise standing where
 * information belongs. The hob is dropped, and a dish left with nothing to say
 * says nothing: no label, no empty row.
 *
 * An icon and a word each, never an icon alone — the word is what is read
 * aloud, and the icon is `aria-hidden` for exactly that reason.
 */
/** One per page: the dish detail renders this line once. */
const LABEL_ID = 'meal-equipment-label';

export function MealEquipment({ dictionary, equipment }: MealEquipmentProps) {
  const shown = equipment.filter(appliance => appliance !== 'stovetop');

  if (shown.length === 0) {
    return null;
  }

  return (
    <div className={styles.equipment}>
      {/* Tied to the list rather than left beside it: a bare span is read as
          loose text, so the list arrives unnamed (`accessibility`, 2026-10-16). */}
      <span className={styles.label} id={LABEL_ID}>
        {dictionary.meal.equipment}
      </span>
      <ul aria-labelledby={LABEL_ID} className={styles.list}>
        {shown.map(appliance => (
          <li className={styles.item} key={appliance}>
            <ApplianceIcon appliance={appliance} />
            {dictionary.kitchen.appliances[appliance]}
          </li>
        ))}
      </ul>
    </div>
  );
}
