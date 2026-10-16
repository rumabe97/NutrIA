import styles from './ChipGroup.module.css';

export interface Chip {
  /**
   * The accessible name, when the visible label is not enough on its own.
   *
   * Ten of these groups on one screen name their rows only in the `legend`,
   * which a screen reader reads when you arrive at the group and not when you
   * swipe from control to control or use the form-controls rotor — the way a
   * form is actually filled on a phone. Without it the kitchen step offers ten
   * identical triplets of "I have one / I do not / I would rather". The
   * **visible** label is unchanged, so what is seen is still a substring of what
   * is announced (2.5.3).
   */
  ariaLabel?: string;
  /** The id of visible text that says why this one cannot be chosen. */
  describedBy?: string;
  /** A second, smaller line under the label, inside the same pill and the same accessible name. */
  detail?: string;
  /** Not selectable, yet still reachable: `aria-disabled` rather than `disabled`, so the reason can be found by keyboard. */
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
              aria-describedby={option.describedBy}
              aria-disabled={option.disabled || undefined}
              aria-label={option.ariaLabel}
              checked={single.choice === option.value}
              className={styles.input}
              name={name}
              onChange={() => (option.disabled ? undefined : single.onChoose(option.value))}
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
