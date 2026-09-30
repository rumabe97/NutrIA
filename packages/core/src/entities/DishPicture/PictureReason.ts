import type { PictureProvenance } from './DishPicture';

/**
 * Why a dish's picture failed or was given back, as the console names it. A
 * closed set on purpose: what a provider answers is free text from a third
 * party, and it never reaches a screen — only one of these words does.
 *
 * - `judge_allergen`: the judge saw a food carrying an allergen the dish lacks (the only thing that rejects a picture).
 * - `judge_rejected`: the judge rejected it for another reason.
 * - `no_provenance`: the file came back without its C2PA manifest, so it is never kept.
 * - `model_refused`: the provider turned the request away (a 4xx other than 402 — a rate limit, a policy).
 * - `payment_refused`: the account cannot pay for another call (402, a spent key or quota).
 * - `call_failed`: a call that ended without an answer we could use (timeout, 5xx, unreadable answer).
 * - `cap_reached`: the month's picture spend reached its cap.
 * - `owner_removed`: the owner took back a picture accepted by hand (`0072`). Not a drawing that failed: the owner's own act.
 * - `other`: anything else, including a row that records nothing.
 */
export const PICTURE_REASONS = [
  'judge_allergen',
  'judge_rejected',
  'no_provenance',
  'model_refused',
  'payment_refused',
  'call_failed',
  'cap_reached',
  'owner_removed',
  'other'
] as const;

export type PictureReason = (typeof PICTURE_REASONS)[number];

function isReason(value: unknown): value is PictureReason {
  return (PICTURE_REASONS as readonly unknown[]).includes(value);
}

/** The status a provider's message carries ("OpenRouter /images answered 402: …"), or null. */
function statusIn(message: string): number | null {
  const found = /answered (\d{3})\b/.exec(message);

  return found?.[1] === undefined ? null : Number(found[1]);
}

/**
 * What a failed call was, from the status it ended with (null when it never
 * got an answer) and its message. The message is only read for words that
 * mean "no budget" (the account's key limit or quota) and for the shapes of
 * failure this code itself raises.
 */
export function reasonOfCall(call: { readonly message: string; readonly status: number | null }): PictureReason {
  const status = call.status ?? statusIn(call.message);

  if (status === 402 || /key limit|exceeded your current quota|resource_exhausted|quota exceeded|insufficient_quota|billing/i.test(call.message)) {
    return 'payment_refused';
  }

  if (status !== null && status >= 400 && status < 500) {
    return 'model_refused';
  }

  if (status !== null || /timed? ?out|timeout|aborted|failed|answered with|wrong shape|no JSON|not a picture/i.test(call.message)) {
    return 'call_failed';
  }

  return 'other';
}

/** A judge's rejection: `judgePicture` rejects only for `extra_allergen:`, and names it in its notes. */
export function reasonOfRejection(notes: string): PictureReason {
  return notes.includes('extra_allergen:') ? 'judge_allergen' : 'judge_rejected';
}

/**
 * The reason behind a `failed` row that was not written with one: the last
 * note of a drawing is how it ended, `<attempt>:<kind>:<text>` or `error:<text>`.
 * Rows written since carry `provenance.reason` and never come here.
 */
function reasonOfNotes(notes: unknown): PictureReason {
  const last = Array.isArray(notes) ? notes.filter((note): note is string => typeof note === 'string').at(-1) : undefined;
  const found = last === undefined ? null : /^(?:\d+:)?(rejected|unkeepable|failed|refused|error):(.*)$/s.exec(last);
  const text = found?.[2] ?? '';

  switch (found?.[1]) {
    case 'rejected':
      return reasonOfRejection(text);
    case 'unkeepable':
      return 'no_provenance';
    case 'failed':
    case 'refused':
    case 'error':
      return reasonOfCall({ message: text, status: null });
    default:
      return 'other';
  }
}

/** The reason behind a released row written before rows carried one: `provenance.released` says why in words. */
function reasonOfRelease(why: string): PictureReason {
  if (/cap is reached/i.test(why)) {
    return 'cap_reached';
  }

  if (/recipe is gone/i.test(why)) {
    return 'other';
  }

  // Besides the cap, only a refusal (`isRefusal`) ever released a drawing: a 402 or a spent key or quota pays nothing more; any other 4xx is the provider's no.
  return reasonOfCall({ message: why, status: null }) === 'payment_refused' ? 'payment_refused' : 'model_refused';
}

/**
 * The closed reason for a `failed` row, from what it stored: `provenance.reason`
 * when it has one, else derived from the notes or the release text of the
 * rows written before it (no migration: the column is `jsonb`).
 */
export function pictureReasonOf(provenance: PictureProvenance | null | undefined): PictureReason {
  if (provenance === null || provenance === undefined || typeof provenance !== 'object') {
    return 'other';
  }

  if (isReason(provenance.reason)) {
    return provenance.reason;
  }

  if (typeof provenance.released === 'string') {
    return reasonOfRelease(provenance.released);
  }

  return reasonOfNotes(provenance.notes);
}
