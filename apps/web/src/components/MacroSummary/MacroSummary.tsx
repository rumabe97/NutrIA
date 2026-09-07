import styles from './MacroSummary.module.css';

import { Text } from 'ui/components/Text';

interface MacroSummaryProps {
  carbsG: number;
  fatG: number;
  kcal: number;
  proteinG: number;
}

/** Calories lead; the macros support them. Four numbers is as much as a glance holds. */
export function MacroSummary({ carbsG, fatG, kcal, proteinG }: MacroSummaryProps) {
  const items = [
    { accent: true, label: 'Calorías', unit: 'kcal', value: kcal },
    { accent: false, label: 'Proteína', unit: 'g', value: proteinG },
    { accent: false, label: 'Carbohidratos', unit: 'g', value: carbsG },
    { accent: false, label: 'Grasas', unit: 'g', value: fatG }
  ];

  return (
    <div className={styles.summary}>
      {items.map(item => (
        <div className={styles.item} data-accent={item.accent} key={item.label}>
          <div className={styles.value}>
            {Math.round(item.value)}
            <span className={styles.unit}> {item.unit}</span>
          </div>
          <Text size="xs" tone="tertiary">
            {item.label}
          </Text>
        </div>
      ))}
    </div>
  );
}
