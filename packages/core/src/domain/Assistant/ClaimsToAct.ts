import { normaliseForMatching } from 'core/domain/Safety';

/**
 * First-person claims of having changed something, in both languages,
 * normalised the way `normaliseForMatching` writes them.
 */
const CLAIMS: readonly string[] = [
  'he actualizado',
  'he ajustado',
  'he anadido',
  'he cambiado',
  'he eliminado',
  'he generado',
  'he guardado',
  'he modificado',
  'he quitado',
  'he reemplazado',
  'he sustituido',
  'lo he cambiado',
  'queda actualizado',
  'te he preparado un plan',
  'tu nuevo plan',
  'ya esta cambiado',
  'i added',
  'i adjusted',
  'i changed',
  'i have added',
  'i have changed',
  'i have generated',
  'i have removed',
  'i have replaced',
  'i have updated',
  'i removed',
  'i replaced',
  'i updated',
  'i ve added',
  'i ve adjusted',
  'i ve changed',
  'i ve generated',
  'i ve removed',
  'i ve replaced',
  'i ve updated',
  'your new plan'
];

const WEEKDAYS = /\b(lunes|martes|miercoles|jueves|viernes|sabado|domingo|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/g;

const NUMBERED_DAYS = /\b(?:dia|day) (\d{1,2})\b/g;

/** How many distinct days an answer has to lay out before it is a plan and not a mention. */
const PLAN_SHAPED = 5;

/**
 * Whether an answer claims to have acted, or writes a plan — `0104` clause 1,
 * as a tested expectation of the answer and not only an instruction to the
 * model.
 *
 * Two shapes, both withheld:
 *
 * - **A claim of a change.** «He cambiado la cena del jueves» changes nothing —
 *   the assistant has no route that could — and the person would believe it,
 *   then cook from a plan that still says the old dish.
 * - **A plan.** Five or more distinct days laid out (`lunes`, `martes`…, or
 *   `día 1`, `día 2`…) is a fortnight being written in prose, outside every
 *   check a real plan goes through: the scheduler, the allergy gate, the ±5 %.
 *   Naming one day — «el jueves tienes lentejas» — is not that.
 */
export function claimsToAct(answer: string): boolean {
  const text = ` ${normaliseForMatching(answer)} `;

  if (CLAIMS.some(claim => text.includes(` ${claim} `))) {
    return true;
  }

  const weekdays = new Set([...text.matchAll(WEEKDAYS)].map(match => match[1]));
  const numbered = new Set([...text.matchAll(NUMBERED_DAYS)].map(match => match[1]));

  return weekdays.size >= PLAN_SHAPED || numbered.size >= PLAN_SHAPED;
}
