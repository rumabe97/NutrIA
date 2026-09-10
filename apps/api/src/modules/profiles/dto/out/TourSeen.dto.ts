/**
 * The tour mark, echoed so the screen that just wrote it does not have to
 * re-read the profile to know what it now says. Declared here because this app
 * composes it: `packages/core` answers the write with nothing.
 */
export interface TourSeenDto {
  readonly seen: boolean;
}
