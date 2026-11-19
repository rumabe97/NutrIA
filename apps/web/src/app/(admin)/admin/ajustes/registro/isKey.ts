/**
 * Whether a value read from an audit row's `detail` is one of the closed words a
 * dictionary map names. The row is JSON from the database: a word written by an
 * older or newer build may not be in this build's map, and an inherited key
 * (`toString`) is never one — so the page says nothing rather than something raw.
 */
export function isKey<T extends object>(value: unknown, words: T): value is keyof T & string {
  return typeof value === 'string' && Object.hasOwn(words, value);
}
