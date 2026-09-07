import { CtaLink } from 'components/CtaLink';
import { EmptyState } from 'components/EmptyState';
import { PlanBrowser } from 'components/PlanBrowser';

import { serverApi } from 'lib/server-api';

import type { OnboardingView } from 'core/controllers/Onboarding';
import type { PlanView } from 'core/controllers/Plan';

export const dynamic = 'force-dynamic';

export default async function PlanPage() {
  // `active` returns null rather than 404 when there is no plan — having none is a
  // normal state, so the empty state is an ordinary render, not an error path.
  const [plan, onboarding] = await Promise.all([serverApi<PlanView | null>('/meal-plans/active'), serverApi<OnboardingView>('/onboarding')]);

  if (plan) {return <PlanBrowser plan={plan} />;}

  if (!onboarding?.isComplete) {
    return (
      <EmptyState body="Necesitamos terminar tu perfil antes de poder calcular tus necesidades y construir catorce días." title="Aún no podemos crear tu plan">
        <CtaLink href={`/onboarding/${Math.min(onboarding?.currentStep ?? 1, 9)}`} size="lg">
          Continuar mi perfil
        </CtaLink>
      </EmptyState>
    );
  }

  return (
    <EmptyState body="Tu perfil está completo. Crea tu primer plan de catorce días con recetas, cantidades y la lista de la compra hecha." title="Todavía no tienes plan">
        <CtaLink href="/plan/generando" size="lg">
          Crear mi plan
        </CtaLink>
      </EmptyState>
  );
}
