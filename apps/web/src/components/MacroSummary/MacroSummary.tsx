'use client';
import styles from './MacroSummary.module.css';

import { Text } from 'ui/components/Text';
import { useDictionary, useLocale } from 'i18n/LocaleProvider';

import { formatNumber } from 'lib/format';

interface MacroSummaryProps {
  carbsG: number;
  fatG: number;
  kcal: number;
  /**
   * Shown under the numbers when they describe food rather than a target: a
   * dish's figures come from composition tables and a label can disagree with
   * them, and the person should hear that where the number is, not in a FAQ.
   */
  note?: string;
  proteinG: number;
}

/** Calories lead; the macros support them. Four numbers is as much as a glance holds. */
export function MacroSummary({ carbsG, fatG, kcal, note, proteinG }: MacroSummaryProps) {
  const dictionary = useDictionary();
  const locale = useLocale();

  const items = [
    { accent: true, label: dictionary.macros.kcal, unit: dictionary.units.kcal, value: kcal },
    { accent: false, label: dictionary.macros.protein, unit: dictionary.units.gram, value: proteinG },
    { accent: false, label: dictionary.macros.carbs, unit: dictionary.units.gram, value: carbsG },
    { accent: false, label: dictionary.macros.fat, unit: dictionary.units.gram, value: fatG }
  ];

  return (
    // The wrapper is the container the columns are decided against: four abreast
    // where the box is wide, two by two where it is not — a rail on a desktop
    // is narrower than a phone, and the window's width said nothing about it.
    <div className={styles.root}>
      <div className={styles.summary} data-note={note ? true : undefined}>
        {items.map(item => (
          <div className={styles.item} data-accent={item.accent} key={item.label}>
            <div className={styles.value}>
              {formatNumber(Math.round(item.value), locale)}
              <span className={styles.unit}> {item.unit}</span>
            </div>
            <Text size="xs" tone="tertiary">
              {item.label}
            </Text>
          </div>
        ))}
        {note ? (
          <Text as="p" className={styles.note} size="xs" tone="tertiary">
            {note}
          </Text>
        ) : null}
      </div>
    </div>
  );
}
