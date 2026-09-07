/**
 * The 14 allergens the EU requires to be declared (Reg. 1169/2011 Annex II),
 * plus the intolerance triggers users actually report. `key` is the stable
 * machine identifier the validator compares — never localise it, never reuse
 * one for a different substance.
 */
export const ALLERGEN_SEED = [
  { isEuMandatory: true, key: 'gluten', labelEs: 'Cereales con gluten' },
  { isEuMandatory: true, key: 'crustaceans', labelEs: 'Crustáceos' },
  { isEuMandatory: true, key: 'eggs', labelEs: 'Huevos' },
  { isEuMandatory: true, key: 'fish', labelEs: 'Pescado' },
  { isEuMandatory: true, key: 'peanuts', labelEs: 'Cacahuetes' },
  { isEuMandatory: true, key: 'soy', labelEs: 'Soja' },
  { isEuMandatory: true, key: 'milk', labelEs: 'Leche y derivados' },
  { isEuMandatory: true, key: 'tree_nuts', labelEs: 'Frutos de cáscara' },
  { isEuMandatory: true, key: 'celery', labelEs: 'Apio' },
  { isEuMandatory: true, key: 'mustard', labelEs: 'Mostaza' },
  { isEuMandatory: true, key: 'sesame', labelEs: 'Sésamo' },
  { isEuMandatory: true, key: 'sulphites', labelEs: 'Sulfitos' },
  { isEuMandatory: true, key: 'lupin', labelEs: 'Altramuces' },
  { isEuMandatory: true, key: 'molluscs', labelEs: 'Moluscos' },
  // Not EU-mandatory declarations, but the intolerances users report most.
  { isEuMandatory: false, key: 'lactose', labelEs: 'Lactosa' },
  { isEuMandatory: false, key: 'fructose', labelEs: 'Fructosa' },
  { isEuMandatory: false, key: 'histamine', labelEs: 'Histamina' }
] as const satisfies readonly { isEuMandatory: boolean; key: string; labelEs: string }[];

export type AllergenKey = (typeof ALLERGEN_SEED)[number]['key'];
