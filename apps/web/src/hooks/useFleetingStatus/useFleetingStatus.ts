'use client';
import { useEffect, useState } from 'react';

/** How long a "copied" or "downloading" line stays: long enough to read, gone before it misleads. */
const FLEETING_MS = 5000;

/**
 * A short confirmation for a `role="status"` line that is mounted empty: set it, and it
 * clears itself after a few seconds — or is replaced by the next one. The button that
 * caused it keeps its label, since a label changing under focus reads inconsistently.
 */
export function useFleetingStatus(): [string | undefined, (message: string) => void] {
  const [message, setMessage] = useState<string>();
  // A new key for each message, so the same words twice restart the timer.
  const [said, setSaid] = useState(0);

  useEffect(() => {
    if (message === undefined) {
      return undefined;
    }

    const timer = window.setTimeout(() => setMessage(undefined), FLEETING_MS);

    return () => window.clearTimeout(timer);
  }, [message, said]);

  return [
    message,
    next => {
      setMessage(next);
      setSaid(previous => previous + 1);
    }
  ];
}
