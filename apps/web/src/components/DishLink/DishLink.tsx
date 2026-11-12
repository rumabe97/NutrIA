'use client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { openDish } from 'lib/dishTransition';

import type { ComponentPropsWithoutRef } from 'react';

interface DishLinkProps extends Omit<ComponentPropsWithoutRef<typeof Link>, 'href'> {
  /** The meal the link opens: its page is `/plan/comida/<mealId>`. */
  mealId: string;
}

/**
 * A link to a dish's page that grows the dish into it (`lib/dishTransition`) where the
 * browser can, and is an ordinary link everywhere else — a new tab, a modified click, a
 * browser without View Transitions, reduced motion. Whatever inside it carries
 * `data-dish-picture` and `data-dish-title` is what grows into the page's picture and
 * title.
 */
export function DishLink({ mealId, onClick, ...rest }: DishLinkProps) {
  const router = useRouter();
  const href = `/plan/comida/${mealId}`;

  return (
    <Link
      {...rest}
      href={href}
      onClick={event => {
        onClick?.(event);

        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
          return;
        }

        if (openDish(event.currentTarget, mealId, () => router.push(href))) {
          event.preventDefault();
        }
      }}
    />
  );
}
