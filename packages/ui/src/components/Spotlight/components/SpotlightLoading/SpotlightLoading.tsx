'use client';
import { Spinner } from 'ui/components/Spinner';

import type { LoadingProps } from '../../types';

/**
 * Conditionally render this while loading asynchronous items. By default the visual is a
 * `<Spinner />`; pass `children` to swap in a custom indicator. `label` is required and
 * provides the progressbar's accessible name — pass the localized loading string for your
 * app (e.g. "Loading", "Cargando", "読み込み中").
 */
export function SpotlightLoading({ children, label, progress, ref, ...etc }: LoadingProps) {
  return (
    <div
      aria-label={label}
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={progress}
      data-spotlight-loading=""
      ref={ref}
      role="progressbar"
      {...etc}
    >
      <div aria-hidden={true}>{children ?? <Spinner />}</div>
    </div>
  );
}
