import type { DishMoment } from 'lib/dishLook';

interface DishGlyphProps {
  className?: string;
  moment: DishMoment;
}

/**
 * The drawing on a dish with no picture: a cup for the morning, a plate for midday, an
 * apple for a snack, a bowl with its steam for the evening. Decorative — the dish's name
 * and slot are always written beside it — so it is hidden from assistive technology.
 */
export function DishGlyph({ className, moment }: DishGlyphProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      focusable="false"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.75"
      viewBox="0 0 24 24"
    >
      {moment === 'morning' ? (
        <path d="M4.5 10h11v3.5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5zM15.5 11.5h1.25a2.25 2.25 0 0 1 0 4.5H15M8 3.5c-.8 1 .8 2-.1 3.2M11.5 3.5c-.8 1 .8 2-.1 3.2M3.5 21h14" />
      ) : null}
      {moment === 'midday' ? (
        <path d="M12 4.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15zM12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM2.5 4v5.5M2.5 9.5v10M21.5 4c-1.4 1.6-1.6 4-1.4 6.5h1.4v9" />
      ) : null}
      {moment === 'snack' ? (
        <path d="M12 8c-2.2-1.4-6.5-1.2-7 3.2-.5 4.3 2.5 9.3 5.2 9.3 1 0 1.2-.5 1.8-.5s.8.5 1.8.5c2.7 0 5.7-5 5.2-9.3C18.5 6.8 14.2 6.6 12 8zM12 8c0-2 .6-3.6 2.4-4.5M12 6.2c-1.3-1.7-3.2-2.2-4.6-1.8.4 1.5 2 2.6 4.6 1.8" />
      ) : null}
      {moment === 'evening' ? <path d="M3.5 12h17a8.5 7 0 0 1-17 0zM8 20h8M9.5 3.5c-.8 1 .8 2.2-.1 3.6M14.5 3.5c-.8 1 .8 2.2-.1 3.6" /> : null}
    </svg>
  );
}
