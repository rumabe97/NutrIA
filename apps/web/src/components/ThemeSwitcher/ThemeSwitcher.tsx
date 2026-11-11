'use client';
import { ThemeSwitch } from 'ui/components/ThemeSwitch';
import { useDictionary } from 'i18n/LocaleProvider';

import { THEME_PAGE_COLOURS } from 'lib/brandColours';

/**
 * The theme menu in a header (`0106`): `ui/components/ThemeSwitch` with this app's words and
 * this app's page colours. The choice stays on the device and only paints the page — the
 * `legal` agent's conditions, `docs/legal/2026-11-11-redesign.md` § 1.7.
 */
export function ThemeSwitcher({ className }: { className?: string }) {
  const { theme } = useDictionary();

  return (
    <ThemeSwitch
      className={className}
      label={theme.label}
      options={{ auto: theme.auto, claro: theme.claro, contraste: theme.contraste, huerta: theme.huerta, oscuro: theme.oscuro, pulso: theme.pulso }}
      themeColors={THEME_PAGE_COLOURS}
    />
  );
}
