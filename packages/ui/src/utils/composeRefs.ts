import type { Ref, RefCallback } from 'react';

type PossibleRef<T> = Ref<T> | undefined;

/**
 * Set a given ref to a given value.
 * Handles both callback refs and RefObject(s).
 */
function setRef<T>(ref: PossibleRef<T>, value: T) {
  if (typeof ref === 'function') {
    return ref(value);
  } else if (ref !== null && ref !== undefined) {
    ref.current = value;
  }
}

/**
 * Compose multiple refs into a single callback ref.
 * Accepts callback refs and RefObject(s).
 *
 * Pure utility — no React hooks. For a memoized version usable inside components,
 * see `ui/hooks/useComposedRefs`.
 */
export function composeRefs<T>(...refs: PossibleRef<T>[]): RefCallback<T> {
  return node => {
    let hasCleanup = false;
    const cleanups = refs.map(ref => {
      const cleanup = setRef(ref, node);

      if (!hasCleanup && typeof cleanup == 'function') {
        hasCleanup = true;
      }

      return cleanup;
    });

    // React <19 will log an error to the console if a callback ref returns a value. We don't
    // use ref cleanups internally so this will only happen if a user's ref callback returns
    // a value, which we only expect if they are using the cleanup functionality added in
    // React 19.
    if (hasCleanup) {
      return () => {
        for (let index = 0; index < cleanups.length; index++) {
          const cleanup = cleanups[index];

          if (typeof cleanup == 'function') {
            cleanup();
          } else {
            setRef(refs[index], null);
          }
        }
      };
    }
  };
}
