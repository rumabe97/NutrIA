import { Fragment } from 'react';

import styles from './Note.module.css';

import type { ComponentPropsWithRef, ReactNode } from 'react';

export type NoteTone = 'error' | 'info' | 'success' | 'warning';

export interface NoteProps extends Omit<ComponentPropsWithRef<'div'>, 'title'> {
  /**
   * The element drawn. `div` by default; `section` for a note with its own heading, `p` for a
   * line of text (`layout="inline"` under a field), `li` inside a list.
   */
  as?: 'aside' | 'div' | 'li' | 'p' | 'section';
  /**
   * `block`, the default: a flat, square-cornered block on its own ground. `inline`: the line
   * under a field that says what is wrong with it — icon and words, no ground.
   */
  layout?: 'block' | 'inline';
  /** Draw `toneLabel` as a visible label over the words. */
  showToneLabel?: boolean;
  /** A title over the words, drawn in the text face's weight. A heading when it is one: pass `titleAs`. */
  title?: ReactNode;
  /** The element the title is drawn in. `p` by default (`strong` inside a `p` note); `h2`–`h4` when it heads a section. */
  titleAs?: 'h2' | 'h3' | 'h4' | 'p' | 'strong';
  /** What kind of note: information (the default), a warning, an error, a success. Drawn by the icon and the ground. */
  tone?: NoteTone;
  /**
   * The tone in a word, from the caller's dictionary ("Aviso", "Error"). The icon says it to the
   * eye; this says it to everybody else, so a note never rests on its colour. Visually hidden
   * unless `showToneLabel`, and never inside the title, so a heading keeps its own name.
   */
  toneLabel?: string;
}

const ICONS: Record<NoteTone, ReactNode> = {
  error: (
    <Fragment>
      <circle cx="10" cy="10" r="7.25" />
      <path d="M7.5 7.5l5 5M12.5 7.5l-5 5" />
    </Fragment>
  ),
  info: (
    <Fragment>
      <circle cx="10" cy="10" r="7.25" />
      <path d="M10 9v4.5" />
      <circle cx="10" cy="6.4" fill="currentColor" r="0.9" stroke="none" />
    </Fragment>
  ),
  success: (
    <Fragment>
      <circle cx="10" cy="10" r="7.25" />
      <path d="M6.8 10.2l2.2 2.2 4.2-4.6" />
    </Fragment>
  ),
  warning: (
    <Fragment>
      <path d="M10 3.2l7.2 12.6H2.8z" strokeLinejoin="round" />
      <path d="M10 8v3.6" />
      <circle cx="10" cy="13.9" fill="currentColor" r="0.9" stroke="none" />
    </Fragment>
  )
};

/**
 * A note: something the screen needs the reader to know, set apart from the words around it
 * (project 024 — no box with a coloured inline-start edge anywhere).
 *
 * A flat, square-cornered block on its own ground, with an icon for the tone and the tone in a
 * word (`toneLabel`), so it never rests on colour alone. Under a field, `layout="inline"` is the
 * same note as one line: icon and words, nothing around them.
 *
 * It sets no role of its own. A note that must interrupt passes `role="alert"`, one that should
 * be announced when it appears `role="status"` — exactly as it did before it was a `Note`.
 */
export function Note({
  as: Component = 'div',
  children,
  className,
  layout = 'block',
  showToneLabel = false,
  title,
  titleAs,
  tone = 'info',
  toneLabel,
  ...rest
}: NoteProps) {
  // Inside a paragraph only phrasing content is allowed: the inner boxes become spans.
  const phrasing = Component === 'p';
  // One element type for the ref: every tag here takes the same attributes a div does.
  const Root = Component as 'div';
  const Body = phrasing ? 'span' : 'div';
  const Title = titleAs ?? (phrasing ? 'strong' : 'p');

  return (
    <Root className={[styles.note, styles[tone], styles[layout], className].filter(Boolean).join(' ')} {...rest}>
      <svg
        aria-hidden="true"
        className={styles.icon}
        fill="none"
        focusable="false"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.6"
        viewBox="0 0 20 20"
      >
        {ICONS[tone]}
      </svg>
      <Body className={styles.body}>
        {toneLabel === undefined ? null : (
          <span className={showToneLabel ? styles.toneLabel : 'visually-hidden'}>{showToneLabel ? toneLabel : `${toneLabel}: `}</span>
        )}
        {title === undefined ? null : <Title className={styles.title}>{title}</Title>}
        {children}
      </Body>
    </Root>
  );
}
