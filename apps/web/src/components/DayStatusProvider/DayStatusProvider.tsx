'use client';
import { createContext, useContext, useMemo, useState } from 'react';

import type { ReactNode } from 'react';

type DayStatusValue = {
  /** A mark just made, or put back after a failure. */
  readonly mark: (mealId: string, status: string) => void;
  /** The marks made on this screen since the server last answered, by meal id. */
  readonly marks: Readonly<Record<string, string>>;
};

const DayStatusContext = createContext<DayStatusValue | null>(null);

interface DayStatusProviderProps {
  children: ReactNode;
  /** The day's meals as the server last returned them. A new answer clears the marks made before it. */
  meals: readonly { readonly id: string; readonly status: string }[];
}

/**
 * The day's marks, shared by what shows them (project 024 phase 4).
 *
 * Inicio's rings sum the meals marked «Hecha», and the tick that marks one is in a row
 * further down the screen. A row reports its mark here the moment it is pressed —
 * optimistic, as the row itself is — and the rings move at once; a failure reports the
 * mark put back. When the server's answer arrives (`router.refresh()` after the row's
 * request), the meals it returns are the truth and the marks made before are dropped.
 */
export function DayStatusProvider({ children, meals }: DayStatusProviderProps) {
  const answer = meals.map(meal => `${meal.id}:${meal.status}`).join(',');
  const [state, setState] = useState<{ answer: string; marks: Record<string, string> }>({ answer, marks: {} });

  // A new answer from the server: the marks were about the old one. Reset during render,
  // the way React recommends for state derived from a prop, so no frame shows both.
  if (state.answer !== answer) {
    setState({ answer, marks: {} });
  }

  const value = useMemo<DayStatusValue>(
    () => ({
      mark: (mealId, status) => setState(current => ({ ...current, marks: { ...current.marks, [mealId]: status } })),
      marks: state.answer === answer ? state.marks : {}
    }),
    [answer, state]
  );

  return <DayStatusContext.Provider value={value}>{children}</DayStatusContext.Provider>;
}

/** The day's marks, where a `DayStatusProvider` is above; null anywhere else (the plan's screen). */
export function useDayStatus(): DayStatusValue | null {
  return useContext(DayStatusContext);
}
