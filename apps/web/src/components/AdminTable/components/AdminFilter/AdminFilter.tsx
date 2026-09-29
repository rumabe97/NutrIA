import { useId } from 'react';

import styles from './AdminFilter.module.css';

export interface AdminFilterOption {
  readonly label: string;
  /** The label's language when it is not the page's — the catalogue's allergen names are Spanish only. */
  readonly lang?: string;
  readonly value: string;
}

interface AdminFilterProps {
  /** The first option, which sends nothing: "Cualquiera". Omit when the parameter has no "either". */
  anyLabel?: string;
  label: string;
  /** The query parameter it submits. */
  name: string;
  options: readonly AdminFilterOption[];
  /** The value in the address, or '' for none. */
  value: string;
}

/**
 * One filter of a console table: a visible label and a native `<select>`, because a
 * native one submits with the form when there is no JavaScript and is the picker a
 * phone already knows.
 */
export function AdminFilter({ anyLabel, label, name, options, value }: AdminFilterProps) {
  const id = useId();

  return (
    <div className={styles.root}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <span className={styles.field}>
        <select className={styles.select} defaultValue={value} id={id} name={name}>
          {anyLabel === undefined ? null : <option value="">{anyLabel}</option>}
          {options.map(option => (
            <option key={option.value} lang={option.lang} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <svg aria-hidden="true" className={styles.chevron} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </div>
  );
}
