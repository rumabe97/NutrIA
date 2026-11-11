'use client';
import { useId } from 'react';

import styles from './AppearancePicker.module.css';

import { Text } from 'ui/components/Text';
import { THEME_CHOICES } from 'ui/utils/theme';
import { useDictionary } from 'i18n/LocaleProvider';
import { useTheme } from 'ui/hooks/useTheme';

import { Card } from 'components/Card';

import { THEME_PAGE_COLOURS } from 'lib/brandColours';

import type { Theme } from 'ui/utils/themeScript';

/** Automático is Claro on a light device and Oscuro on a dark one: its preview shows both. */
const AUTO_PAIR: readonly Theme[] = ['claro', 'oscuro'];

/**
 * «Apariencia» in Perfil: the header's theme menu, as six small previews to choose from
 * (`0106`). The same state — choosing here changes the header's menu, and the other way round.
 *
 * Each preview is drawn by that theme's own tokens: the swatch carries `data-theme`, and
 * `styles/themes.css` answers to it on any element. Automático shows Claro and Oscuro side by
 * side, because that is what it is.
 *
 * Native radios, one name, so the arrow keys move through them the way a radio group's do, and
 * the whole tile is the label a finger hits.
 */
export function AppearancePicker() {
  const dictionary = useDictionary();
  const t = dictionary.theme;
  const [choice, choose] = useTheme(THEME_PAGE_COLOURS);
  const titleId = useId();
  const hintId = useId();
  const name = useId();

  return (
    <Card aria-labelledby={titleId} as="section" className={styles.panel}>
      <h3 className={styles.title} id={titleId}>
        {t.appearance}
      </h3>
      <Text id={hintId} size="sm" tone="secondary">
        {t.appearanceHint}
      </Text>

      <div aria-describedby={hintId} aria-labelledby={titleId} className={styles.options} role="radiogroup">
        {THEME_CHOICES.map(option => (
          <label className={styles.option} key={option}>
            <span aria-hidden="true" className={styles.preview}>
              {(option === 'auto' ? AUTO_PAIR : [option]).map(theme => (
                // A miniature page in that theme: its ground, a card, a line of ink and the fill.
                <span className={styles.swatch} data-theme={theme} key={theme}>
                  <span className={styles.card}>
                    <span className={styles.ink} />
                    <span className={styles.soft} />
                    <span className={styles.fill} />
                  </span>
                </span>
              ))}
            </span>
            <span className={styles.choice}>
              <input checked={choice === option} className={styles.radio} name={name} onChange={() => choose(option)} type="radio" value={option} />
              <span className={styles.name}>{t[option]}</span>
            </span>
          </label>
        ))}
      </div>
    </Card>
  );
}
