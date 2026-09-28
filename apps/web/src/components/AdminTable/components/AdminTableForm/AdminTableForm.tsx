'use client';
import { useEffect, useRef } from 'react';

import { useRouter } from 'next/navigation';

import type { ChangeEvent, FormEvent, ReactNode } from 'react';

interface AdminTableFormProps {
  /** The page the form submits to: the table's own address. */
  action: string;
  /** Where the page lands after a submit without JavaScript: the table, not the top. */
  anchor: string;
  /** The fields, drawn on the server: search, filters, page size, the kept parameters and the submit button. */
  children: ReactNode;
  className?: string;
  /** Names the form for a screen reader ("Buscar y filtrar"). */
  label: string;
  /** What each field shows for the address on screen, so the back button puts the fields back too. */
  values: Readonly<Record<string, string>>;
}

/** How long the search waits after the last key before it asks. */
const SEARCH_DELAY_MS = 300;

/** The form's fields as a query string, leaving out the empty ones. */
function searchOf(form: HTMLFormElement): string {
  const search = new URLSearchParams();

  for (const [key, value] of new FormData(form)) {
    if (typeof value === 'string' && value.trim() !== '') {
      search.append(key, value.trim());
    }
  }

  return search.toString();
}

/**
 * The table's toolbar as a plain GET form (`0068`), made quicker when JavaScript is there.
 *
 * Without it, the form submits with its button and the server draws the new view. With
 * it, a filter or the page size applies as soon as it changes, and the search 300 ms after
 * the last key, through the router: the page is not reloaded, so focus stays where the
 * person is typing or choosing. Either way the result is an address, and the offset is
 * never one of the fields — a new search or filter always starts at the first page.
 */
export function AdminTableForm({ action, anchor, children, className, label, values }: AdminTableFormProps) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const valuesKey = JSON.stringify(values);

  useEffect(() => () => clearTimeout(timer.current), []);

  // The fields are uncontrolled. When the address changes under them (the back button),
  // they take its values — except the one somebody is typing in.
  useEffect(() => {
    const element = form.current;

    if (!element) {
      return;
    }

    for (const [name, value] of Object.entries(JSON.parse(valuesKey) as Record<string, string>)) {
      const field = element.elements.namedItem(name);

      if ((field instanceof HTMLInputElement || field instanceof HTMLSelectElement) && field !== document.activeElement && field.value !== value) {
        field.value = value;
      }
    }
  }, [valuesKey]);

  function apply() {
    clearTimeout(timer.current);

    if (form.current) {
      const search = searchOf(form.current);

      router.push(search ? `${action}?${search}` : action, { scroll: false });
    }
  }

  function onChange(event: ChangeEvent<HTMLFormElement>) {
    if (event.target instanceof HTMLInputElement && event.target.type === 'search') {
      clearTimeout(timer.current);
      timer.current = setTimeout(apply, SEARCH_DELAY_MS);
    } else {
      apply();
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    apply();
  }

  return (
    <form
      action={`${action}#${anchor}`}
      aria-label={label}
      className={className}
      method="get"
      onChange={onChange}
      onSubmit={onSubmit}
      ref={form}
      role="search"
    >
      {children}
    </form>
  );
}
