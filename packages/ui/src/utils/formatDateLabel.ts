const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A `YYYY-MM-DD` day as an axis label in `locale` — "28 Sept", "28 sept".
 *
 * The day is read and written in UTC. It names a calendar day, not an instant: in any
 * other zone, `new Date('2026-09-28')` is midnight UTC and a reader west of Greenwich
 * would see the 27th. Anything that is not an ISO day comes back as it was.
 */
export function formatDateLabel(day: string, locale: string, options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }): string {
  if (!ISO_DAY.test(day)) {
    return day;
  }

  const time = Date.parse(`${day}T00:00:00Z`);

  return Number.isNaN(time) ? day : new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(time);
}
