/**
 * The day a paused plan picks up again: the morning **after** the last day away.
 *
 * The shift moves every plan day at or after the trip forward by its whole
 * length (`0032`), so a trip ending on the 11th puts the next meal on the 12th.
 * Showing the last day away as the day you come back is a day of somebody's
 * holiday spent wondering where dinner is.
 *
 * Lives here because three screens ask the same question and a fourth will.
 */
export function resumesOn(endsOn: string): string {
  return new Date(Date.parse(`${endsOn}T00:00:00Z`) + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
