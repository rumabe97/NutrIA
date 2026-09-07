import { Fragment } from 'react';

import styles from './page.module.css';

import { Text } from 'ui/components/Text';

import { CtaLink } from 'components/CtaLink';
import { EmptyState } from 'components/EmptyState';
import { MacroSummary } from 'components/MacroSummary';
import { MealRow } from 'components/MealRow';

import { serverApi } from 'lib/server-api';

import type { FullProfileView } from 'core/controllers/Profile';
import type { OnboardingView } from 'core/controllers/Onboarding';
import type { PlanView } from 'core/controllers/Plan';
import type { UserView } from 'core/controllers/User';

export const dynamic = 'force-dynamic';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function greeting(hour: number): string {
  if (hour < 6) {return 'Buenas noches';}

  if (hour < 14) {return 'Buenos días';}

  if (hour < 21) {return 'Buenas tardes';}

  return 'Buenas noches';
}

export default async function DashboardPage() {
  const [user, onboarding, profile, plan] = await Promise.all([
    serverApi<UserView>('/users/me'),
    serverApi<OnboardingView>('/onboarding'),
    serverApi<FullProfileView>('/profile'),
    serverApi<PlanView | null>('/meal-plans/active')
  ]);

  const firstName = (profile?.profile?.displayName ?? user?.name ?? '').split(' ')[0];
  const hello = firstName ? `${greeting(new Date().getHours())}, ${firstName}.` : greeting(new Date().getHours());
  const today = new Date().toISOString().slice(0, 10);
  const day = plan?.days.find(candidate => candidate.date === today);

  return (
    <Fragment>
      <h1 className={styles.greeting}>{hello}</h1>

      {plan ? (
        <Fragment>
          <Text tone="secondary">
            {day ? `Día ${day.dayIndex} de ${plan.days.length}` : 'Tu plan está activo'} · próxima revisión {checkInLabel(plan.endDate)}
          </Text>

          {day ? (
            <section className={styles.todayCard}>
              <div className={styles.todayHeading}>
                <Text size="lg" weight="semibold">
                  Hoy
                </Text>
                <CtaLink href="/plan" size="sm" variant="ghost">
                  Ver los 14 días →
                </CtaLink>
              </div>

              <MacroSummary carbsG={day.totals.carbsG} fatG={day.totals.fatG} kcal={day.totals.kcal} proteinG={day.totals.proteinG} />

              <div className={styles.meals}>
                {day.meals.map(meal => (
                  <MealRow id={meal.id} kcal={meal.kcal} key={meal.id} name={meal.name} proteinG={meal.proteinG} slot={meal.slot} />
                ))}
              </div>
            </section>
          ) : (
            // The plan is active but today falls outside its dates — the fortnight
            // has run its course and the next one is due.
            <EmptyState
              body="Tu plan ha llegado al final de sus catorce días. Crea el siguiente cuando quieras."
              title="Tu plan ha terminado"
            >
              <CtaLink href="/plan/generando" size="lg">
                Crear mi próximo plan
              </CtaLink>
              <CtaLink href="/plan" size="lg" variant="secondary">
                Ver el plan anterior
              </CtaLink>
            </EmptyState>
          )}
        </Fragment>
      ) : (
        <Fragment>
          <Text tone="secondary">{onboarding?.isComplete ? 'Tu perfil está completo.' : 'Todavía nos faltan un par de cosas.'}</Text>

          {onboarding?.isComplete ? (
            <EmptyState
              body="Ya tenemos todo lo que necesitamos sobre ti. Crearemos catorce días completos con recetas, cantidades y la lista de la compra hecha."
              title="Todavía no tienes plan"
            >
              <CtaLink href="/plan/generando" size="lg">
                Crear mi plan
              </CtaLink>
            </EmptyState>
          ) : (
            <EmptyState
              body={`Has completado ${onboarding?.completedSteps.length ?? 0} de 8 pasos. Cuando termines podremos calcular tus necesidades y preparar tu primer plan.`}
              title="Termina tu perfil"
            >
              <CtaLink href={`/onboarding/${Math.min(onboarding?.currentStep ?? 1, 9)}`} size="lg">
                Continuar donde lo dejé
              </CtaLink>
            </EmptyState>
          )}
        </Fragment>
      )}

      {profile?.targets ? (
        <Fragment>
          <Text className={styles.targetsLabel} size="sm" tone="tertiary">
            Tus objetivos diarios
          </Text>
          <MacroSummary carbsG={profile.targets.carbsG} fatG={profile.targets.fatG} kcal={profile.targets.kcal} proteinG={profile.targets.proteinG} />
          {profile.targets.wasClamped ? (
            <p className={styles.notice}>
              Hemos ajustado tu ritmo: el objetivo que elegiste quedaba por debajo del mínimo diario de calorías que consideramos seguro sin supervisión
              profesional.
            </p>
          ) : null}
        </Fragment>
      ) : null}
    </Fragment>
  );
}

function checkInLabel(endDate: string): string {
  const remaining = Math.ceil((new Date(`${endDate}T00:00:00`).getTime() - Date.now()) / MS_PER_DAY);

  if (remaining < 0) {return 'ya disponible';}

  if (remaining === 0) {return 'hoy';}

  if (remaining === 1) {return 'mañana';}

  return `en ${remaining} días`;
}
