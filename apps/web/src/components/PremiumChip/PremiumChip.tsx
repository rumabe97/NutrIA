import styles from './PremiumChip.module.css';

/**
 * The mark on something this account does not open: a padlock and the word
 * beside it (`0021` § *Amended*).
 *
 * **The word carries the meaning, never the padlock.** The icon is
 * `aria-hidden` and has no title, drawn inline in `currentColor` at `1em` so it
 * takes the colour and the size of the text it sits in — including when the
 * reader has doubled that size. The same reasoning as `ApplianceIcon`, and the
 * same reason there is no emoji here: an emoji is ten pictures on ten devices,
 * sized to none of them.
 *
 * It is not a control. What it marks is listed and not openable, so there is
 * nothing to press: a row that looks like a door and is not would be worse than
 * no row at all.
 */
export function PremiumChip({ label }: Readonly<{ label: string }>) {
  return (
    <span className={styles.chip}>
      <svg aria-hidden="true" className={styles.icon} focusable="false" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <rect height="10" rx="2" width="14" x="5" y="11" />
        <path d="M8.5 11V7.5a3.5 3.5 0 0 1 7 0V11" />
      </svg>
      {label}
    </span>
  );
}
