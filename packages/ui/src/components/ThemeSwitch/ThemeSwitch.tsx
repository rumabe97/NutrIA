'use client';
import styles from './ThemeSwitch.module.css';

import { Dropdown, DropdownRadioGroup, DropdownRadioOption } from 'ui/components/Dropdown';
import { THEME_CHOICES } from 'ui/utils/theme';
import { useTheme } from 'ui/hooks/useTheme';

import type { ThemeChoice } from 'ui/utils/themeScript';
import type { ThemeColors } from 'ui/utils/theme';

export interface ThemeSwitchProps {
  /** Composed onto the button's own class. */
  className?: string;
  /** The button's accessible name — the word for "theme" in the page's language. */
  label: string;
  /** Each choice's name, in the page's language: Automático and the five themes. */
  options: Readonly<Record<ThemeChoice, string>>;
  /** Each theme's page colour, for the browser's chrome (`theme-color`). */
  themeColors?: ThemeColors;
}

/**
 * The theme menu (`0106`): a button with an icon and a name, opening the six choices as
 * `menuitemradio`s on `Dropdown`. Choosing one paints the page at once, keeps it on this device
 * (Automático keeps nothing) and gives the browser's chrome the theme's colour. Every instance
 * on a page, and every tab, shows the same choice.
 *
 * The words come in as props: the library knows no language and imports no app code.
 */
export function ThemeSwitch({ className, label, options, themeColors }: ThemeSwitchProps) {
  const [choice, choose] = useTheme(themeColors);

  return (
    <Dropdown
      align="end"
      aria-label={label}
      className={className ? `${styles.trigger} ${className}` : styles.trigger}
      label={
        <svg aria-hidden="true" className={styles.icon} fill="none" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.6" />
          <path d="M12 3.75a8.25 8.25 0 0 1 0 16.5Z" fill="currentColor" />
        </svg>
      }
    >
      <DropdownRadioGroup onValueChange={value => choose(value as ThemeChoice)} value={choice}>
        {THEME_CHOICES.map(option => (
          <DropdownRadioOption key={option} value={option}>
            {options[option]}
          </DropdownRadioOption>
        ))}
      </DropdownRadioGroup>
    </Dropdown>
  );
}
