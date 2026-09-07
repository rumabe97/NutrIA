import type { OnboardingStep } from 'core/entities/Onboarding';

/**
 * The eight data steps plus a review screen.
 *
 * `core/entities/Onboarding` declares ten (the tenth is plan generation, which
 * arrives with the meal-engine project). Here we render nine, and the review
 * step closes onboarding — so the flow never shows a step whose action does not
 * yet exist.
 *
 * The `step` key is what the API's discriminated union expects; keeping the
 * ordering in one array is what keeps the progress bar, the URL and the server's
 * completeness check in agreement.
 */
export const FLOW = [
  { key: 'about-you', subtitle: 'Con esto calculamos tus necesidades. Nada de esto se comparte.', title: 'Sobre ti' },
  { key: 'goal', subtitle: 'Puedes cambiarlo en cualquier momento.', title: 'Tu objetivo' },
  { key: 'body-activity', subtitle: 'Cuánto te mueves cambia bastante las cifras.', title: 'Cuerpo y actividad' },
  { key: 'how-you-eat', subtitle: 'Cómo repartes la comida a lo largo del día.', title: 'Cómo comes' },
  { key: 'food-preferences', subtitle: 'Lo que te gusta aparecerá más. Lo que no, desaparece.', title: 'Preferencias' },
  { key: 'allergies', subtitle: 'Esto es un límite, no una preferencia: no aparecerá nunca.', title: 'Alergias e intolerancias' },
  { key: 'lifestyle', subtitle: 'Para que las comidas caigan cuando puedes comértelas.', title: 'Tu día a día' },
  { key: 'cooking', subtitle: 'Sé sincero: un plan que no puedes cocinar no sirve.', title: 'Cocina' },
  { key: 'review', subtitle: 'Comprueba que todo está bien antes de terminar.', title: 'Revisión' }
] as const satisfies readonly { key: 'review' | OnboardingStep; subtitle: string; title: string }[];

export const TOTAL_STEPS = FLOW.length;
