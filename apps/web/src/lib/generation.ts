/**
 * User-facing copy for a generation job's outcome.
 *
 * The API records a stable code on the job; this is the only place it becomes
 * Spanish. `GENERATION_POOL_TOO_SMALL` gets its own explanation on purpose — with
 * `AI_PROVIDER=stub` and an empty recipe library it is the *expected* result, not a
 * malfunction, and a generic "algo ha ido mal" would send someone hunting a bug
 * that isn't there.
 */
export const GENERATION_ERRORS: Record<string, { readonly body: string; readonly canRetry: boolean; readonly title: string }> = {
  GENERATION_ABANDONED: {
    body: 'El servidor se reinició mientras preparábamos tu plan. No se ha guardado nada a medias.',
    canRetry: true,
    title: 'Se interrumpió'
  },
  GENERATION_AI_UNAVAILABLE: {
    body: 'Tu proveedor de IA está configurado pero ha rechazado la petición. Suele ser la clave (ANTHROPIC_API_KEY o GOOGLE_API_KEY), el nombre del modelo en AI_MODEL, o haber agotado la cuota gratuita. El detalle exacto está en el log del servidor.',
    canRetry: true,
    title: 'El proveedor de IA ha fallado'
  },
  GENERATION_FAILED: {
    body: 'Algo ha ido mal por nuestra parte. No se ha guardado nada, así que puedes volver a intentarlo.',
    canRetry: true,
    title: 'No hemos podido crear tu plan'
  },
  GENERATION_INVALID_PLAN: {
    body: 'Hemos construido un plan pero no cumplía tus objetivos nutricionales, así que lo hemos descartado en lugar de dártelo.',
    canRetry: true,
    title: 'El plan no salía bien'
  },
  GENERATION_ONBOARDING_INCOMPLETE: {
    body: 'Nos faltan datos tuyos para poder calcular tus necesidades.',
    canRetry: false,
    title: 'Falta terminar tu perfil'
  },
  GENERATION_POOL_TOO_SMALL: {
    body: 'Todavía no tenemos suficientes recetas que encajen con tus restricciones y no hay ningún proveedor de IA configurado, así que no podemos crear las que faltan. Configura AI_PROVIDER en el servidor, o espera a que la biblioteca de recetas crezca.',
    canRetry: true,
    title: 'Nos faltan recetas'
  },
  GENERATION_PROFILE_INCOMPLETE: {
    body: 'Necesitamos tu fecha de nacimiento, altura, sexo, peso y nivel de actividad para calcular tus objetivos.',
    canRetry: false,
    title: 'Falta información en tu perfil'
  },
  GENERATION_UNSAFE_CONTENT: {
    body: 'Hemos bloqueado el plan porque una comida no respetaba tus alergias. Preferimos no darte nada antes que darte algo que no puedes comer.',
    canRetry: true,
    title: 'Lo hemos bloqueado por seguridad'
  }
};

export const UNKNOWN_GENERATION_ERROR = GENERATION_ERRORS.GENERATION_FAILED as { body: string; canRetry: boolean; title: string };

export function generationError(code: string | null): { body: string; canRetry: boolean; title: string } {
  return (code ? GENERATION_ERRORS[code] : undefined) ?? UNKNOWN_GENERATION_ERROR;
}

export const SLOT_LABELS: Record<string, string> = {
  afternoon_snack: 'Merienda',
  breakfast: 'Desayuno',
  dinner: 'Cena',
  lunch: 'Comida',
  morning_snack: 'Almuerzo',
  supper: 'Recena'
};

export const CATEGORY_LABELS: Record<string, string> = {
  bakery: 'Panadería',
  beverages: 'Bebidas',
  dairy: 'Lácteos',
  frozen: 'Congelados',
  other: 'Otros',
  pantry: 'Despensa',
  produce: 'Frutas y verduras',
  protein: 'Carne y pescado'
};

/** Grams read as kilos above 1 kg. The stored unit is always grams — this is display only. */
export function formatQuantity(quantity: number, unit: string): string {
  if (unit === 'g' && quantity >= 1000) {return `${(quantity / 1000).toFixed(quantity % 1000 === 0 ? 0 : 1).replace('.', ',')} kg`;}

  if (unit === 'ml' && quantity >= 1000) {return `${(quantity / 1000).toFixed(1).replace('.', ',')} l`;}

  const rounded = Math.round(quantity * 10) / 10;
  const value = String(rounded).replace('.', ',');

  return unit === 'unit' ? `${value} ud.` : unit === 'slice' ? `${value} reb.` : `${value} ${unit}`;
}
