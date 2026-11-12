/**
 * Destinations, in the order the product loop uses them — plan, shop, eat, see
 * how it went. One list, drawn once by `AppNav`: a floating bar below 48rem and
 * a rail at the side from there (project 024 phase 3), so the two can never disagree.
 */
const DESTINATIONS = [
  { href: '/inicio', icon: 'M3 10.5 12 3l9 7.5M5.5 9.5V20h13V9.5', label: 'home' },
  { href: '/plan', icon: 'M7 4h10a1 1 0 0 1 1 1v15l-6-3-6 3V5a1 1 0 0 1 1-1Z', label: 'plan' },
  { href: '/compra', icon: 'M4 6h2l2.2 9.4a1 1 0 0 0 1 .8h7.7a1 1 0 0 0 1-.8L20 9H7M9 20h.01M17 20h.01', label: 'shopping' },
  { href: '/progreso', icon: 'M3 17l6-6 4 4 8-8M15 7h6v6', label: 'progress' },
  { href: '/perfil', icon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20a7.5 7.5 0 0 1 15 0', label: 'profile' }
] as const;

/**
 * A professional's own workspace — appended after the client destinations,
 * never in `DESTINATIONS` itself, because it is the one entry the API's
 * `professional` flag decides on (`0059`, `0061`). Display only: `/consulta`
 * 404s server-side for anyone else, so a stale or spoofed flag draws a link
 * that leads nowhere rather than a hole.
 */
const PRACTICE_DESTINATION = {
  href: '/consulta',
  icon: 'M4 8h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1ZM9 8V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18',
  label: 'consulta'
} as const;

/**
 * The assistant (project 023) — before the profile, only while its switch is
 * on. Display only, like the practice: `/asistente` 404s server-side while the
 * switch is off, so a stale flag draws a link that leads nowhere, never a hole.
 */
const ASSISTANT_DESTINATION = {
  href: '/asistente',
  icon: 'M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-9l-5 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1ZM8 10h8M8 13h5',
  label: 'assistant'
} as const;

export type Destination = (typeof DESTINATIONS)[number] | typeof ASSISTANT_DESTINATION | typeof PRACTICE_DESTINATION;

interface DestinationFlags {
  /** The `assistant` switch (`GET /settings`), display only. */
  assistant: boolean;
  /** Whether a path opens now — `useOffline().available`: offline, only the stored ones (`0053`). */
  available: (path: string) => boolean;
  /** `UserView.professional` (`GET /users/me`), display only. */
  professional: boolean;
}

/** The destinations this person is shown, in order: five, six or seven, fewer offline. */
export function destinationsFor({ assistant, available, professional }: DestinationFlags): Destination[] {
  const client: Destination[] = assistant ? [...DESTINATIONS.slice(0, -1), ASSISTANT_DESTINATION, ...DESTINATIONS.slice(-1)] : [...DESTINATIONS];
  const all = professional ? [...client, PRACTICE_DESTINATION] : client;

  return all.filter(destination => available(destination.href));
}

/** The destination the address is in, if any: `/plan/historial` is Plan, `/check-in` is none. */
export function currentHref(pathname: string, destinations: readonly Destination[]): string | undefined {
  return destinations.find(destination => pathname.startsWith(destination.href))?.href;
}
