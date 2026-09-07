import Link from 'next/link';

import styles from './MealRow.module.css';

import { SLOT_LABELS } from 'lib/generation';

interface MealRowProps {
  id: string;
  kcal: number;
  name: string;
  proteinG: number;
  slot: string;
}

export function MealRow({ id, kcal, name, proteinG, slot }: MealRowProps) {
  return (
    <Link className={styles.row} href={`/plan/comida/${id}`}>
      <span className={styles.slot}>{SLOT_LABELS[slot] ?? slot}</span>
      <span className={styles.name}>{name}</span>
      <span className={styles.meta}>
        {Math.round(kcal)} kcal · {Math.round(proteinG)} g P
      </span>
    </Link>
  );
}
