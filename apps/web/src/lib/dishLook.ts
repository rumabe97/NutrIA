/**
 * How a dish with no picture is drawn (project 024 phase 4).
 *
 * Most dishes have no picture today, so their state is the common one and must look
 * meant: a ground in the colour of the meal's moment of the day and a glyph for it,
 * never an empty frame. Four moments, not six slots — the two snacks are one kind of
 * plate, and a late supper is an evening one — each drawn in a ring colour of the theme,
 * paled into a ground (`--color-slot-*`, `styles/themes.css`). The glyph differs per
 * moment as well, so the state never rests on colour alone.
 */
export type DishMoment = 'evening' | 'midday' | 'morning' | 'snack';

const MOMENT: Readonly<Record<string, DishMoment>> = {
  afternoon_snack: 'snack',
  breakfast: 'morning',
  dinner: 'evening',
  lunch: 'midday',
  morning_snack: 'snack',
  supper: 'evening'
};

/** The moment a slot belongs to. A slot nobody has mapped is drawn as a midday plate rather than as nothing. */
export function dishMoment(slot: string | null | undefined): DishMoment {
  return (slot ? MOMENT[slot] : undefined) ?? 'midday';
}
