import styles from './ChipGroup.module.css';

export interface Chip {
  /** A second, smaller line under the label, inside the same pill and the same accessible name. */
  detail?: string;
  /** Not selectable; the pill stays in the group so the choice reads as complete. */
  disabled?: boolean;
  label: string;
  value: string;
}

interface ChipGroupProps {
  name: string;
  options: readonly Chip[];
  selected?: readonly string[];
  /** Radio semantics: one answer, controlled by `choice` and `onChoose`. Omitted, the group is multi-select checkboxes. */
  single?: { choice: string; onChoose: (value: string) => void };
}

/**
 * Pills over real inputs. Multi-select by default, submitting as repeated
 * checkbox values; with `single`, a radio group for one answer.
 */
export function ChipGroup({ name, options, selected = [], single }: ChipGroupProps) {
  return (
    <div className={styles.chips}>
      {options.map(option => (
        <label className={styles.chip} key={option.value}>
          {single ? (
            <input
              checked={single.choice === option.value}
              className={styles.input}
              disabled={option.disabled}
              name={name}
              onChange={() => single.onChoose(option.value)}
              type="radio"
              value={option.value}
            />
          ) : (
            <input
              className={styles.input}
              defaultChecked={selected.includes(option.value)}
              disabled={option.disabled}
              name={name}
              type="checkbox"
              value={option.value}
            />
          )}
          {option.detail ? (
            <span className={styles.stack}>
              <span>{option.label}</span>
              <span className={styles.detail}>{option.detail}</span>
            </span>
          ) : (
            option.label
          )}
        </label>
      ))}
    </div>
  );
}
