/** The calendar day, in Spain, that an instant falls on, as `YYYY-MM-DD`: the day the API's notice rules count in. */
export function madridDay(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Madrid', year: 'numeric' }).format(now);
}

/** A calendar day `days` later (or earlier), as `YYYY-MM-DD`: arithmetic on the date alone, with no clock or zone in it. */
export function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number);

  return new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, (day ?? 1) + days)).toISOString().slice(0, 10);
}
