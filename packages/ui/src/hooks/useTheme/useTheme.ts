import { useEffect, useSyncExternalStore } from 'react';

import { applyThemeColor, chooseTheme, readTheme, subscribeTheme } from 'ui/utils/theme';

import type { ThemeChoice } from 'ui/utils/themeScript';
import type { ThemeColors } from 'ui/utils/theme';

/** The server knows nothing of a device's choice; every page is rendered as Automático. */
function serverSnapshot(): ThemeChoice {
  return 'auto';
}

/**
 * The theme chosen on this device, and the way to choose another (`0106`).
 *
 * Every control that shows the choice reads it from here, so the header's menu and Perfil's
 * «Apariencia» agree with each other, and with another tab, without a context. Rendered on the
 * server as Automático; the first client render after hydration reads the device.
 *
 * `colors` is each theme's page colour, for the browser's own chrome (`theme-color`); without
 * it the chrome keeps the page's served colours.
 */
export function useTheme(colors?: ThemeColors): [ThemeChoice, (choice: ThemeChoice) => void] {
  const choice = useSyncExternalStore(subscribeTheme, readTheme, serverSnapshot);

  useEffect(() => {
    applyThemeColor(choice, colors);
  }, [choice, colors]);

  return [choice, chooseTheme];
}
