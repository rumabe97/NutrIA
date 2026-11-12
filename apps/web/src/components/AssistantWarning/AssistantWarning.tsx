import styles from './AssistantWarning.module.css';

import { Link } from 'ui/components/Link';
import { Note } from 'ui/components/Note';

import type { Dictionary } from 'i18n/dictionaries/es-ES';

/** Where the warning's link to the privacy policy goes (`docs/legal/assistant-warning.md` § 1). */
const PRIVACY_PLACEHOLDER = '{privacy}';

interface AssistantWarningProps {
  /** Shown in full after the button (EXPANDED). Meaningful only when `folded`. */
  readonly expanded: boolean;
  /** The conversation has a message: one line and «Aviso completo» (FOLDED); otherwise the whole text (FULL). */
  readonly folded: boolean;
  /** The id the button's `aria-controls` names: the full text's. */
  readonly fullId: string;
  readonly onToggle: () => void;
  /** `/privacidad#asistente` in the reader's language. */
  readonly privacyHref: string;
  readonly t: Dictionary['assistant'];
}

/**
 * The assistant's warning, the first item of every conversation (project 023, PRD 12), in
 * the three states the `legal` agent's design allows (`docs/legal/2026-11-11-redesign.md`
 * § 6.5, approved by the owner on 2026-11-12):
 *
 * - **FULL** while the conversation has no message: every word, with its privacy link.
 * - **FOLDED** once it has one, and in every reopened conversation: the AI sentence and the
 *   health instruction in one line that wraps (never clamped), and a native button
 *   «Aviso completo» that says whether the rest is open (`aria-expanded`) and which text it
 *   opens (`aria-controls`).
 * - **EXPANDED** after that button: the whole text straight after it, in the same `Note`.
 *
 * The state is the caller's React state, worked out from the turns on screen: nothing is
 * stored anywhere, so every visit starts FULL or FOLDED and the server draws the same thing
 * the browser will. Never a live region — folding is not news — and always a `Note` with its
 * «Aviso», so it never reads as one of the model's answers.
 */
export function AssistantWarning({ expanded, folded, fullId, onToggle, privacyHref, t }: AssistantWarningProps) {
  // In the page whether open or not, so `aria-controls` always names something; closed, it is
  // `hidden`, which takes it out of view and out of the accessibility tree.
  const full = (
    <p className={styles.text} hidden={folded ? !expanded : false} id={fullId}>
      {t.warning.split(/(\{privacy\})/).map(part =>
        part === PRIVACY_PLACEHOLDER ? (
          <Link href={privacyHref} inline={true} key={part}>
            {t.warningPrivacy}
          </Link>
        ) : (
          part
        )
      )}
    </p>
  );

  return (
    <Note as="li" showToneLabel={true} tone="warning" toneLabel={t.warningLabel}>
      {folded ? (
        <div className={styles.folded}>
          <p className={styles.text}>{t.warningShort}</p>
          <button aria-controls={fullId} aria-expanded={expanded} className={styles.more} onClick={onToggle} type="button">
            {t.warningMore}
            <svg
              aria-hidden="true"
              className={styles.chevron}
              fill="none"
              focusable="false"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 16 16"
            >
              <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {full}
        </div>
      ) : (
        full
      )}
    </Note>
  );
}
