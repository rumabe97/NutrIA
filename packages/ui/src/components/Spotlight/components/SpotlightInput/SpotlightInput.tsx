'use client';
import { useEffect } from 'react';

import { useCommand } from '../../hooks/useCommand';
import { useSpotlight } from '../../hooks/useSpotlight';
import { useStore } from '../../hooks/useStore';

import type { ChangeEvent } from 'react';
import type { InputProps } from '../../types';

/** Command menu search input. All props are forwarded to the underlying `<input>`. */
export function SpotlightInput({ onValueChange, ref, ...props }: InputProps) {
  const isControlled = props.value != null;
  const store = useStore();
  const search = useSpotlight(state => state.search);
  const selectedItemId = useSpotlight(state => state.selectedItemId);
  const context = useCommand();

  useEffect(() => {
    if (props.value != null) {
      store.setState('search', props.value);
    }
    // Only react to the controlled `value` changing; store identity is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.value]);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (!isControlled) {
      store.setState('search', event.target.value);
    }

    onValueChange?.(event.target.value);
  };

  return (
    <input
      ref={ref}
      {...props}
      aria-activedescendant={selectedItemId}
      aria-autocomplete="list"
      aria-controls={context.listId}
      aria-expanded={true}
      aria-labelledby={context.labelId}
      autoComplete="off"
      autoCorrect="off"
      data-spotlight-input=""
      id={context.inputId}
      onChange={handleChange}
      role="combobox"
      spellCheck={false}
      type="text"
      value={isControlled ? (props.value ?? '') : search}
    />
  );
}
