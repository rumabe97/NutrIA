import styles from './BadgeScript.module.css';

import { interpolate } from 'lib/format';

interface BadgeScriptProps {
  /** `adminBadge.script`: the approved script's steps, `textos/06` § T, with its placeholders. */
  script: { readonly no: string; readonly steps: readonly string[]; readonly yes: string };
  values: { expires: string; register: string; registerName: string };
}

/**
 * The phone script the owner reads (`docs/legal/textos/06` § T): not a template, a
 * list of what to say and in which order, with the college and the name as the
 * register shows them filled in. Step 3 branches — the person asked for it, or did not
 * — so the two answers are a list inside it. Spanish, as it is read aloud to a person
 * in Spain: the block says `lang="es"` whatever the console's language is.
 */
export function BadgeScript({ script, values }: BadgeScriptProps) {
  const filled = { ...values, registerName: values.registerName.trim() === '' ? '…' : values.registerName.trim() };
  const [first, second, third, fourth, fifth] = script.steps;

  return (
    <ol className={styles.script} lang="es">
      <li>{interpolate(first ?? '', filled)}</li>
      <li>{interpolate(second ?? '', filled)}</li>
      <li>
        {interpolate(third ?? '', filled)}
        <ul className={styles.branches}>
          <li>{interpolate(script.yes, filled)}</li>
          <li>{interpolate(script.no, filled)}</li>
        </ul>
      </li>
      <li>{interpolate(fourth ?? '', filled)}</li>
      <li>{interpolate(fifth ?? '', filled)}</li>
    </ol>
  );
}
