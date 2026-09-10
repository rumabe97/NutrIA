'use client';
import { Fragment, useState } from 'react';

import { useRouter } from 'next/navigation';
import Link from 'next/link';

import styles from './HealthPanel.module.css';

import { Button } from 'ui/components/Button';
import { Checkbox } from 'ui/components/Checkbox';
import { Input } from 'ui/components/Input';
import { Text } from 'ui/components/Text';
import { useDictionary, useLocale } from 'i18n/LocaleProvider';

import { api, messageFor } from 'lib/api';
import { formatNumber, interpolate } from 'lib/format';

import type { ConditionKey } from 'core/entities/Health';
import type { HealthView } from 'core/controllers/Health';

/**
 * The keys, in the order they are offered. The labels come from the dictionary —
 * this list is the vocabulary `core/entities/Health` defines, and it must not
 * drift from it.
 */
const CONDITION_KEYS = [
  'coeliac',
  'lactose_intolerance',
  'type_1_diabetes',
  'type_2_diabetes',
  'hypertension',
  'hypercholesterolemia',
  'ibs',
  'gerd',
  'hypothyroidism',
  'pcos',
  'chronic_kidney_disease',
  'gout',
  'pregnancy',
  'breastfeeding'
] as const;

const CONSENT_VERSION = '1.0.0';

/** `key` is a stable client-side row identity — new rows have no server id yet, and an array index changes the moment one is removed. */
type SupplementRow = { key: string; name: string; proteinGPerServing: string; servingsPerDay: string };

/**
 * Conditions, medications and supplements — collected as health data or not at all.
 *
 * What this screen deliberately does not do: interpret any of it. A condition
 * produces a dietary restriction only where avoiding the substance *is* the
 * definition of managing it, and that list is short, curated and signed off
 * outside the code. A medication produces nothing at all, ever. Everything else
 * produces the same thing: a recommendation to have the plan looked at by
 * someone qualified, which is the honest limit of what a meal planner can say.
 */
export function HealthPanel({ health }: { health: HealthView }) {
  const router = useRouter();
  const dictionary = useDictionary();
  const locale = useLocale();
  const t = dictionary.health;
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [consented, setConsented] = useState(health.consentIsCurrent);
  const [conditionKeys, setConditionKeys] = useState<readonly string[]>(() =>
    health.conditions.flatMap(condition => (condition.conditionKey === null ? [] : [condition.conditionKey as string]))
  );
  const [otherConditions, setOtherConditions] = useState(() =>
    health.conditions
      .filter(condition => condition.conditionKey === null)
      .map(condition => condition.label)
      .join(', ')
  );
  const [medications, setMedications] = useState(() => health.medications.map(medication => medication.name).join(', '));
  const [supplements, setSupplements] = useState<readonly SupplementRow[]>(() =>
    health.supplements.map(supplement => ({
      key: supplement.id,
      name: supplement.name,
      proteinGPerServing: supplement.proteinGPerServing === null ? '' : String(supplement.proteinGPerServing),
      servingsPerDay: String(supplement.servingsPerDay)
    }))
  );

  async function save() {
    setError(undefined);
    setPending(true);

    try {
      await api<HealthView>('/health-data', {
        body: {
          conditions: [
            ...conditionKeys.map(key => ({ conditionKey: key, label: dictionary.conditions[key as ConditionKey] ?? key })),
            ...splitList(otherConditions).map(label => ({ conditionKey: null, label }))
          ],
          consentVersion: CONSENT_VERSION,
          medications: splitList(medications).map(name => ({ name })),
          supplements: supplements
            .filter(row => row.name.trim() !== '')
            .map(row => ({
              name: row.name.trim(),
              proteinGPerServing: row.proteinGPerServing === '' ? null : Number(row.proteinGPerServing),
              servingsPerDay: row.servingsPerDay === '' ? 1 : Number(row.servingsPerDay)
            }))
        },
        method: 'PUT'
      });
      setOpen(false);
      router.refresh();
    } catch (caught) {
      setError(messageFor(caught, dictionary));
    } finally {
      setPending(false);
    }
  }

  async function withdraw() {
    setError(undefined);
    setPending(true);

    try {
      await api<HealthView>('/health-data', { method: 'DELETE' });
      setConditionKeys([]);
      setOtherConditions('');
      setMedications('');
      setSupplements([]);
      setConsented(false);
      setOpen(false);
      router.refresh();
    } catch (caught) {
      setError(messageFor(caught, dictionary));
    } finally {
      setPending(false);
    }
  }

  const recorded = health.conditions.length + health.medications.length + health.supplements.length;

  return (
    <section className={styles.panel}>
      <div className={styles.heading}>
        <h2 className={styles.title}>{t.title}</h2>
        <Button onClick={() => setOpen(!open)} type="button" variant="secondary">
          {open ? dictionary.common.close : recorded > 0 ? dictionary.common.edit : dictionary.common.add}
        </Button>
      </div>

      <Text size="sm" tone="secondary">
        {t.intro}
      </Text>

      {recorded > 0 ? (
        <dl className={styles.summary}>
          <div className={styles.row}>
            <dt>{t.conditions}</dt>
            <dd>{health.conditions.map(condition => condition.label).join(', ') || dictionary.common.none}</dd>
          </div>
          <div className={styles.row}>
            <dt>{t.medications}</dt>
            <dd>{health.medications.map(medication => medication.name).join(', ') || dictionary.common.none}</dd>
          </div>
          <div className={styles.row}>
            <dt>{t.supplements}</dt>
            <dd>
              {health.supplements.length > 0
                ? health.supplements
                    .map(supplement =>
                      supplement.proteinGPerServing === null
                        ? supplement.name
                        : `${supplement.name} (${supplement.proteinGPerServing} g × ${supplement.servingsPerDay})`
                    )
                    .join(', ')
                : dictionary.common.noneMasculine}
            </dd>
          </div>
          {health.supplementProteinG > 0 ? (
            <div className={styles.row}>
              <dt>{t.supplementProteinLabel}</dt>
              {/* Said, not subtracted. The plan is still built for the full target;
                  quietly lowering it on the strength of a number the user typed
                  would change their target without telling them. */}
              <dd>
                {interpolate(t.supplementProteinTotal, { grams: formatNumber(health.supplementProteinG, locale) })}{' '}
                <strong>{t.supplementProteinTotalEmphasis}</strong> {t.supplementProteinTotalTail}
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      {health.derivedExclusions.length > 0 ? (
        <div className={styles.applied}>
          {/* Named with its cause. A restriction whose reason is invisible is one
              the user cannot argue with, and this one they did not ask for. */}
          {health.derivedExclusions.map(effect => (
            <p key={`${effect.conditionLabel}-${effect.allergenLabel}`}>
              {interpolate(t.applied, { allergen: effect.allergenLabel.toLowerCase(), condition: effect.conditionLabel.toLowerCase() })}
            </p>
          ))}
        </div>
      ) : null}

      {health.suggestedExclusions.length > 0 ? (
        <div className={styles.suggestion}>
          {/* Offered, not applied. Most people with lactose intolerance tolerate
              some lactose, so how strict to be is theirs to decide — and the
              place to decide it is the list where every other restriction lives. */}
          {health.suggestedExclusions.map(effect => (
            <p key={`${effect.conditionLabel}-${effect.allergenLabel}`}>
              {interpolate(t.suggestion, { allergen: effect.allergenLabel.toLowerCase(), condition: effect.conditionLabel.toLowerCase() })}{' '}
              <Link href="/onboarding/6">{t.addSuggestionLink}</Link>.
            </p>
          ))}
        </div>
      ) : null}

      {!health.consentIsCurrent && recorded > 0 ? <p className={styles.notice}>{t.consentStale}</p> : null}

      {open ? (
        <Fragment>
          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>{t.conditions}</legend>
            <div className={styles.chips}>
              {CONDITION_KEYS.map(key => (
                <Checkbox
                  checked={conditionKeys.includes(key)}
                  key={key}
                  label={dictionary.conditions[key]}
                  onCheckedChange={value =>
                    setConditionKeys(value === true ? [...conditionKeys, key] : conditionKeys.filter(current => current !== key))
                  }
                />
              ))}
            </div>
            <Input
              hint={t.conditionsOtherHint}
              label={t.conditionsOther}
              onChange={event => setOtherConditions(event.target.value)}
              value={otherConditions}
            />
          </fieldset>

          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>{t.medications}</legend>
            <Input hint={t.medicationsHint} label={t.medicationsLabel} onChange={event => setMedications(event.target.value)} value={medications} />
            <Text className={styles.hint} size="xs" tone="tertiary">
              {t.medicationsNote}
            </Text>
          </fieldset>

          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>{t.supplements}</legend>
            {supplements.map((row, index) => (
              <div className={styles.supplement} key={row.key}>
                <Input
                  label={t.supplementName}
                  onChange={event => setSupplements(update(supplements, index, { ...row, name: event.target.value }))}
                  value={row.name}
                />
                <Input
                  label={t.supplementProtein}
                  onChange={event => setSupplements(update(supplements, index, { ...row, proteinGPerServing: event.target.value }))}
                  type="number"
                  value={row.proteinGPerServing}
                />
                <Input
                  label={t.supplementServings}
                  min="1"
                  onChange={event => setSupplements(update(supplements, index, { ...row, servingsPerDay: event.target.value }))}
                  type="number"
                  value={row.servingsPerDay}
                />
                <Button onClick={() => setSupplements(supplements.filter((_, at) => at !== index))} type="button" variant="secondary">
                  {dictionary.common.remove}
                </Button>
              </div>
            ))}
            <Button
              onClick={() => setSupplements([...supplements, { key: crypto.randomUUID(), name: '', proteinGPerServing: '', servingsPerDay: '1' }])}
              type="button"
              variant="secondary"
            >
              {t.supplementAdd}
            </Button>
          </fieldset>

          <div className={styles.consent}>
            <Checkbox checked={consented} label={t.consentLabel} name="consent" onCheckedChange={value => setConsented(value === true)} />
            <Text className={styles.hint} size="xs" tone="tertiary">
              {t.consentNote}
            </Text>
          </div>

          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}

          <div className={styles.actions}>
            <Button disabled={!consented} loading={pending} onClick={() => void save()} type="button">
              {pending ? dictionary.common.saving : dictionary.common.save}
            </Button>
            {recorded > 0 ? (
              <Button disabled={pending} onClick={() => void withdraw()} type="button" variant="secondary">
                {t.withdraw}
              </Button>
            ) : null}
          </div>
        </Fragment>
      ) : null}
    </section>
  );
}

function splitList(value: string): string[] {
  return value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function update(rows: readonly SupplementRow[], index: number, row: SupplementRow): SupplementRow[] {
  return rows.map((current, at) => (at === index ? row : current));
}
