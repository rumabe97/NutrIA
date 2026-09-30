/** Who had accepted a picture the owner removed: the judge, or the owner by hand. */
export type RemovedAcceptedBy = 'judge' | 'owner';

/**
 * Who a `picture.removed` row says had accepted the picture (project 010) — a closed word.
 * Null for a row written before the removal said so (`{}`), and for anything else in its
 * place: the trail then shows nothing rather than a guess.
 */
export function removedAcceptedBy(detail: Readonly<Record<string, unknown>> | null): RemovedAcceptedBy | null {
  const acceptedBy = detail?.acceptedBy;

  return acceptedBy === 'judge' || acceptedBy === 'owner' ? acceptedBy : null;
}
