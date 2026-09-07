'use client';
import Link from 'next/link';

import styles from './MealRow.module.css';

import { useDictionary, useLocale } from 'i18n/LocaleProvider';

import { formatNumber } from 'lib/format';
import { slotLabel } from 'lib/generation';

interface MealRowProps {
  id: string;
  kcal: number;
  name: string;
  proteinG: number;
  slot: string;
}

export function MealRow({ id, kcal, name, proteinG, slot }: MealRowProps) {
  const dictionary = useDictionary();
  const locale = useLocale();

  return (
    <Link className={styles.row} href={`/plan/comida/${id}`}>
      <span className={styles.slot}>{slotLabel(slot, dictionary)}</span>
      <span className={styles.name}>{name}</span>
      <span className={styles.meta}>
        {formatNumber(Math.round(kcal), locale)} {dictionary.units.kcal} · {formatNumber(Math.round(proteinG), locale)} {dictionary.units.proteinShort}
      </span>
    </Link>
  );
}
