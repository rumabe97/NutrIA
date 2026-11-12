import styles from './OptionCards.module.css';

import { Text } from 'ui/components/Text';

export interface Option {
  hint?: string;
  label: string;
  value: string;
}

interface OptionCardsProps {
  /**
   * `cards` (the default): one selectable card per option, with its hint. `segmented`: the
   * options as one segmented control (project 024, the check-in's sheet) — the same radios,
   * drawn as segments of a sunken track, the chosen one filled in the text colour.
   */
  layout?: 'cards' | 'segmented';
  name: string;
  options: readonly Option[];
  value?: string | null;
}

export function OptionCards({ layout = 'cards', name, options, value }: OptionCardsProps) {
  return (
    <div className={layout === 'segmented' ? styles.segmented : styles.options}>
      {options.map(option => (
        <label className={styles.option} key={option.value}>
          <input className={styles.input} defaultChecked={value === option.value} name={name} type="radio" value={option.value} />
          <span className={styles.label}>
            <Text as="span" size="sm" weight="medium">
              {option.label}
            </Text>
            {option.hint ? (
              <Text as="span" size="xs" tone="tertiary">
                {option.hint}
              </Text>
            ) : null}
          </span>
        </label>
      ))}
    </div>
  );
}
