import styles from './HeaderPattern.module.css';

/**
 * The hatched pattern behind a header — the owner's exception, PRD 024 criterion 9: it drifts
 * by itself. Still under reduced motion, absent in Alto contraste and forced colours. Decoration
 * only: hidden from assistive technology and never in the way of a tap.
 */
export function HeaderPattern() {
  return (
    <div aria-hidden="true" className={styles.pattern}>
      <div className={styles.hatch} />
    </div>
  );
}
