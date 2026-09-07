import { Fragment } from 'react';

import styles from './page.module.css';

import { Text } from 'ui/components/Text';

import { DeleteAccount } from 'components/DeleteAccount';
import { ProfileSection } from 'components/ProfileSection';

import { serverApi } from 'lib/server-api';

import type { FullProfileView } from 'core/controllers/Profile';
import type { UserView } from 'core/controllers/User';

export const dynamic = 'force-dynamic';

const GOAL_LABELS: Record<string, string> = {
  custom: 'Personalizado',
  healthy_eating: 'Comer sano',
  maintenance: 'Mantenimiento',
  muscle_gain: 'Ganar músculo',
  performance: 'Rendimiento',
  weight_loss: 'Perder peso'
};

const ACTIVITY_LABELS: Record<string, string> = {
  athlete: 'Deportista',
  high: 'Alto',
  light: 'Ligero',
  moderate: 'Moderado',
  sedentary: 'Sedentario'
};

function list(values: readonly string[], empty: string): string {
  return values.length > 0 ? values.join(', ') : empty;
}

export default async function ProfilePage() {
  const [user, profile] = await Promise.all([serverApi<UserView>('/users/me'), serverApi<FullProfileView>('/profile')]);
  const person = profile?.profile;
  const goal = profile?.goal;
  const preferences = profile?.preferences;
  const foodPreferences = profile?.foodPreferences ?? [];

  return (
    <Fragment>
      <h1 className={styles.title}>Tu perfil</h1>
      <Text tone="secondary">Todo esto alimenta tus planes. Cámbialo cuando cambie tu vida.</Text>

      <div className={styles.sections}>
        <ProfileSection
          editHref="/onboarding/1"
          rows={[
            { label: 'Nombre', value: user?.name },
            { label: 'Correo', value: user?.email },
            { label: 'Correo verificado', value: user?.emailVerified ? 'Sí' : 'Pendiente' }
          ]}
          title="Cuenta"
        />

        <ProfileSection
          editHref="/onboarding/1"
          rows={[
            { label: 'Nombre para mostrar', value: person?.displayName },
            { label: 'Fecha de nacimiento', value: person?.birthDate },
            { label: 'Altura', value: person?.heightCm ? `${person.heightCm} cm` : undefined },
            { label: 'País', value: person?.country }
          ]}
          title="Datos personales"
        />

        <ProfileSection
          editHref="/onboarding/2"
          rows={[
            { label: 'Objetivo', value: goal ? GOAL_LABELS[goal.type] : undefined },
            { label: 'Peso actual', value: goal?.startingWeightKg ? `${goal.startingWeightKg} kg` : undefined },
            { label: 'Peso objetivo', value: goal?.targetWeightKg ? `${goal.targetWeightKg} kg` : undefined },
            { label: 'Ritmo', value: goal?.paceKgPerWeek ? `${goal.paceKgPerWeek} kg / semana` : undefined }
          ]}
          title="Objetivo"
        />

        <ProfileSection
          editHref="/onboarding/6"
          rows={[
            { label: 'Alergias', value: list((profile?.allergies ?? []).map(allergy => allergy.allergenLabel), 'Ninguna') },
            { label: 'Intolerancias', value: list((profile?.intolerances ?? []).map(intolerance => intolerance.allergenLabel), 'Ninguna') },
            { label: 'Tipo de alimentación', value: list(profile?.dietaryPatterns ?? [], 'Sin restricción') }
          ]}
          title="Restricciones"
        />

        <ProfileSection
          editHref="/onboarding/4"
          rows={[
            { label: 'Comidas al día', value: preferences?.mealsPerDay ? String(preferences.mealsPerDay) : undefined },
            { label: 'Tentempiés', value: preferences?.includesSnacks ? 'Sí' : 'No' },
            { label: 'Actividad', value: preferences?.activityLevel ? ACTIVITY_LABELS[preferences.activityLevel] : undefined },
            { label: 'Tiempo para cocinar', value: preferences?.cookingTimeMinutes ? `${preferences.cookingTimeMinutes} min` : undefined }
          ]}
          title="Cómo comes"
        />

        <ProfileSection
          editHref="/onboarding/5"
          rows={[
            { label: 'Te gusta', value: list(foodPreferences.filter(item => item.sentiment === 'liked').map(item => item.label), '—') },
            { label: 'No quieres ver', value: list(foodPreferences.filter(item => item.sentiment === 'disliked').map(item => item.label), '—') },
            { label: 'Cocinas', value: list(profile?.cuisines ?? [], '—') }
          ]}
          title="Preferencias"
        />

        <div className={`${styles.card} ${styles.danger}`}>
          <div className={styles.cardHead}>
            <Text weight="semibold">Borrar mi cuenta</Text>
          </div>
          <Text size="sm" tone="secondary">
            Se elimina todo: perfil, objetivos, restricciones, planes, progreso y conversaciones. No se puede deshacer.
          </Text>
          <DeleteAccount />
        </div>
      </div>
    </Fragment>
  );
}
