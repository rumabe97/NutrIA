import { personDayKey } from 'core/domain/Period';
import { ProfileRepository } from '#repositories/Profile';

/**
 * The person's calendar day at `now`, in the time zone their profile keeps
 * (project 015) — the one "today" every rule about a plan, a trip, an event, a
 * mark or a check-in decides with. A plan is laid out in this day, so a rule
 * that read the UTC date would call day one "tomorrow" for an hour or two after
 * Madrid's midnight.
 */
export async function personToday(userId: string, now: Date = new Date()): Promise<string> {
  const profile = await ProfileRepository.findByUserId(userId);

  return personDayKey(now, profile?.timezone);
}
