import styles from './SettingSwitch.module.css';

import { Switch } from 'ui/components/Switch';
import { Text } from 'ui/components/Text';

interface SettingSwitchProps {
  checked: boolean;
  /** What went wrong the last time it was flipped, if anything. */
  error?: string;
  /** What is true *now*, under the switch. */
  hint: string;
  label: string;
  onCheckedChange: (next: boolean) => void;
  /** Where the switch sits: before its words (the default), or at the row's end with the words on its left (the console's). */
  placement?: 'end' | 'start';
}

/**
 * A switch with its name and one line under it: the shape every setting takes,
 * on the profile and on `/admin`.
 *
 * The whole line is the label, so the words are as tappable as the control,
 * and on a phone the line is a finger tall.
 */
export function SettingSwitch({ checked, error, hint, label, onCheckedChange, placement = 'start' }: SettingSwitchProps) {
  return (
    <div className={styles.root} data-placement={placement}>
      <label className={styles.line}>
        <span className={styles.control}>
          <Switch checked={checked} onCheckedChange={onCheckedChange} />
        </span>
        <Text className={styles.name} size="sm">
          {label}
        </Text>
      </label>
      <Text className={styles.hint} size="xs" tone="tertiary">
        {hint}
      </Text>
      {error ? (
        <Text className={styles.error} size="xs">
          {error}
        </Text>
      ) : null}
    </div>
  );
}
