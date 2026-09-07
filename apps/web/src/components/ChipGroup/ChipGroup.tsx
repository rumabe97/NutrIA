import styles from './ChipGroup.module.css';

export interface Chip {
  label: string;
  value: string;
}

interface ChipGroupProps {
  name: string;
  options: readonly Chip[];
  selected: readonly string[];
}

/** Multi-select rendered as pills. Submits as repeated checkbox values. */
export function ChipGroup({ name, options, selected }: ChipGroupProps) {
  return (
    <div className={styles.chips}>
      {options.map(option => (
        <label className={styles.chip} key={option.value}>
          <input className={styles.input} defaultChecked={selected.includes(option.value)} name={name} type="checkbox" value={option.value} />
          {option.label}
        </label>
      ))}
    </div>
  );
}
