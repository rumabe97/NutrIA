import { prefersReducedMotion } from 'ui/utils/prefersReducedMotion';

/**
 * A dish card growing into its page (project 024, PRD § Motion: "a dish card grows into
 * its page"), with the View Transition names `ui/styles/motion` reserves: `dish-<id>` on
 * the picture, `dish-title-<id>` on the name.
 *
 * A client navigation, so the browser cannot see the new page arrive on its own: the
 * transition is started here, the router is asked to go, and the update is declared done
 * when the dish's page says it has mounted (`components/DishArrival`) — or after
 * `WAIT_MS`, so a slow server never freezes the screen for longer than that; the
 * transition then simply cross-fades to whatever is there.
 *
 * Where the browser has no View Transitions, or the person asked for less motion, nothing
 * here runs and the link navigates as any link does.
 */

/** The longest the old screen is held while the dish's page is fetched. */
const WAIT_MS = 1500;

type TransitionDocument = Document & { startViewTransition?: (update: () => Promise<void>) => { finished: Promise<void> } };

let settle: (() => void) | null = null;

/** The dish's page has mounted: the transition may draw it. */
export function dishArrived(): void {
  settle?.();
  settle = null;
}

/** The names a dish card and its page share, for a meal. */
export function dishTransitionNames(mealId: string): { picture: string; title: string } {
  return { picture: `dish-${mealId}`, title: `dish-title-${mealId}` };
}

/**
 * Opens a dish with the transition, when it can. Returns false when it cannot, so the
 * caller lets the link do its ordinary navigation.
 *
 * The names go on the tapped card only, and only now: a name must be unique on the page,
 * and a day's list holds several dishes.
 */
export function openDish(source: HTMLElement, mealId: string, go: () => void): boolean {
  const doc = document as TransitionDocument;

  if (typeof doc.startViewTransition !== 'function' || prefersReducedMotion()) {
    return false;
  }

  const names = dishTransitionNames(mealId);
  const named: HTMLElement[] = [];

  for (const [selector, name] of [
    ['[data-dish-picture]', names.picture],
    ['[data-dish-title]', names.title]
  ] as const) {
    const element = source.querySelector<HTMLElement>(selector);

    if (element) {
      element.style.viewTransitionName = name;
      named.push(element);
    }
  }

  const transition = doc.startViewTransition(
    () =>
      new Promise<void>(resolve => {
        settle = resolve;
        go();
        setTimeout(() => {
          if (settle === resolve) {
            settle = null;
            resolve();
          }
        }, WAIT_MS);
      })
  );

  void transition.finished
    .catch(() => undefined)
    .finally(() => {
      for (const element of named) {
        element.style.viewTransitionName = '';
      }
    });

  return true;
}
