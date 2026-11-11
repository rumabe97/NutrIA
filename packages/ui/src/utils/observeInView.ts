/**
 * One `IntersectionObserver` for the whole page, shared by everything that waits to be seen
 * (`useInView`, `useCountUp`, the web app's `Reveal`).
 *
 * A screen with twenty tiles and four charts would otherwise build twenty-four observers; one
 * costs the same per frame as one, and an element is dropped from it the moment it has been
 * seen, because a figure that re-animates every time you scroll past reads as a glitch.
 *
 * `onSeen` runs once, the first time the element crosses into view. The returned function stops
 * waiting (an unmount before it was reached).
 */
const ROOT_MARGIN = '0px 0px -12% 0px';
const THRESHOLD = 0.1;

const waiting = new Map<Element, () => void>();
let observer: IntersectionObserver | null = null;

function shared(): IntersectionObserver {
  if (observer === null) {
    observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (!entry.isIntersecting) {
            continue;
          }

          const onSeen = waiting.get(entry.target);

          forget(entry.target);
          onSeen?.();
        }
      },
      { rootMargin: ROOT_MARGIN, threshold: THRESHOLD }
    );
  }

  return observer;
}

/** Stop watching an element; with nothing left to watch, the observer goes too. */
function forget(element: Element) {
  if (!waiting.delete(element)) {
    return;
  }

  observer?.unobserve(element);

  if (waiting.size === 0) {
    observer?.disconnect();
    observer = null;
  }
}

export function observeInView(element: Element, onSeen: () => void): () => void {
  const io = shared();

  waiting.set(element, onSeen);
  io.observe(element);

  return () => forget(element);
}

/**
 * Whether an element is below the fold right now — the only moment that tells the truth:
 * hydration can land after the reader has already scrolled, and what they have reached has been
 * read. Only an element that is still below is worth arming.
 */
export function isBelowFold(element: Element): boolean {
  return element.getBoundingClientRect().top >= window.innerHeight;
}
