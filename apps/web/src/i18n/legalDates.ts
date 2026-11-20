import { madridDay } from '../lib/madridDay';

/**
 * The dates the privacy policy and the terms of use print. Both pages are static: whatever
 * here depends on the day is decided when the page is built.
 */

/**
 * The day the privacy policy and the terms of use were last changed: the one value both
 * documents print as «Última actualización» / "Last updated" (`LegalScreen`).
 *
 * Set it to the day the changed pages are deployed to production, not the day they are
 * written. One value for both, because they move together; if one ever changes alone,
 * split it here. Nothing else reads it.
 */
export const LEGAL_TEXTS_UPDATED = '2026-11-17';

/**
 * The day anyone can open a practice: the day the owner throws the `professional` switch,
 * the same `{date}` as the change notice (`docs/legal/textos/06` § Z). `YYYY-MM-DD`, or
 * `null` while that day is not fixed.
 *
 * Until that day, «Tu profesional en NutrIA» and «Si trabajas con un profesional» open with
 * one dated line saying it starts then (`docs/legal/2026-11-18-anyone-can-open-a-practice.md`
 * § 4 P-0, § 5 T-0): their present tense would be false before the switch. The line is
 * decided at build time, so it stops showing at the first deploy on or after the day.
 *
 * Two rules come with it (go-live checklist § 1 bis): the switch is thrown no earlier than
 * this day, and if the switch slips, this moves the same day.
 */
export const PRACTICES_OPEN_ON: string | null = null;

/**
 * The day practices open, while it is still ahead (in Spain's calendar): the dated line
 * shows. `null` when no day is set, or once that day has come — the line does not show.
 */
export function practicesOpenAhead(openOn: string | null, now: Date): string | null {
  return openOn !== null && madridDay(now) < openOn ? openOn : null;
}
