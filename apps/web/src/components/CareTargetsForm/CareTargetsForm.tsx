'use client';
import { useEffect, useRef, useState } from 'react';

import { useRouter } from 'next/navigation';

import styles from './CareTargetsForm.module.css';

import { Button } from 'ui/components/Button';
import { Input } from 'ui/components/Input';
import { Text } from 'ui/components/Text';
import { useDictionary, useLocale } from 'i18n/LocaleProvider';

import { Card } from 'components/Card';
import { MacroSummary } from 'components/MacroSummary';

import { api, ApiError, messageFor } from 'lib/api';
import { formatNumber, interpolate } from 'lib/format';

import type { ResolvedTargets } from 'core/domain/Nutrition';

type Draft = { carbsG: string; fatG: string; kcal: string; proteinG: string };

const FIELDS = ['kcal', 'proteinG', 'carbsG', 'fatG'] as const;

interface CareTargetsFormProps {
  linkId: string;
  targets: ResolvedTargets;
}

/**
 * A client's daily targets as their professional sets them (PRD 004,
 * criterion 7): the client's own body and bounds, through the link. A value
 * out of bounds comes back as the API's sentence naming the bound, shown as it
 * is — that sentence is the whole value of the refusal. An emptied field goes
 * back to the computed value.
 */
export function CareTargetsForm({ linkId, targets }: CareTargetsFormProps) {
  const router = useRouter();
  const dictionary = useDictionary();
  const locale = useLocale();
  const t = dictionary.practice;
  const labels = dictionary.targets;
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<readonly string[]>([]);
  // Which fields the schema refused. The API's sentence for a field is the validator's, in English, so the
  // field says so in the reader's words; the personalised bounds come back under `targets`, verbatim.
  const [invalid, setInvalid] = useState<ReadonlySet<keyof Draft>>(new Set());
  const [draft, setDraft] = useState<Draft>(() => toDraft(targets));
  const trigger = useRef<HTMLButtonElement>(null);
  const firstField = useRef<HTMLInputElement>(null);
  const mounted = useRef(false);
  const { bounds, effective, overrideStatus, setBy } = targets;

  // Opening the form puts the caret in its first field; closing it gives focus back to the button that opened it.
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;

      return;
    }

    if (editing) {
      firstField.current?.focus();
    } else {
      trigger.current?.focus();
    }
  }, [editing]);

  async function save(body: Record<string, number | null>) {
    setErrors([]);
    setInvalid(new Set());
    setPending(true);

    try {
      await api(`/care/clients/${encodeURIComponent(linkId)}/targets`, { body, method: 'PATCH' });
      setEditing(false);
      router.refresh();
    } catch (caught) {
      const named = caught instanceof ApiError ? caught.fieldErrors.targets : undefined;

      setInvalid(new Set(FIELDS.filter(field => caught instanceof ApiError && (caught.fieldErrors[field]?.length ?? 0) > 0)));
      setErrors(
        named && named.length > 0 ? named : [caught instanceof ApiError && caught.code === 'NOT_FOUND' ? t.gone : messageFor(caught, dictionary)]
      );
    } finally {
      setPending(false);
    }
  }

  const source =
    overrideStatus !== 'applied' || !setBy
      ? t.targetsEstimated
      : setBy.kind === 'professional'
        ? interpolate(t.targetsProfessional, { name: setBy.name })
        : t.targetsSelf;

  return (
    <Card aria-labelledby="targets-title" as="section" className={styles.card}>
      <div>
        <h2 className={styles.title} id="targets-title">
          {t.targetsTitle}
        </h2>
        <Text size="sm" tone="tertiary">
          {source}
        </Text>
      </div>

      <MacroSummary carbsG={effective.carbsG} fatG={effective.fatG} kcal={effective.kcal} proteinG={effective.proteinG} />

      {errors.length > 0 ? (
        <div className={styles.errors} role="alert">
          {errors.map(error => (
            <p key={error}>{error}</p>
          ))}
        </div>
      ) : null}

      {editing ? (
        <form
          className={styles.form}
          onSubmit={event => {
            event.preventDefault();
            void save({ carbsG: toNumber(draft.carbsG), fatG: toNumber(draft.fatG), kcal: toNumber(draft.kcal), proteinG: toNumber(draft.proteinG) });
          }}
        >
          <Input
            error={invalid.has('kcal') ? t.targetsFieldInvalid : undefined}
            hint={interpolate(t.targetsBounds, {
              max: formatNumber(Math.floor(bounds.ceilingKcal), locale),
              min: formatNumber(Math.ceil(bounds.floorKcal), locale)
            })}
            inputMode="numeric"
            label={labels.labelKcal}
            onChange={event => setDraft({ ...draft, kcal: event.target.value })}
            ref={firstField}
            value={draft.kcal}
          />
          <Input
            error={invalid.has('proteinG') ? t.targetsFieldInvalid : undefined}
            hint={interpolate(labels.hintUpTo, { max: formatNumber(Math.floor(bounds.proteinCeilingG), locale) })}
            inputMode="numeric"
            label={labels.labelProtein}
            onChange={event => setDraft({ ...draft, proteinG: event.target.value })}
            value={draft.proteinG}
          />
          <Input
            error={invalid.has('carbsG') ? t.targetsFieldInvalid : undefined}
            inputMode="numeric"
            label={labels.labelCarbs}
            onChange={event => setDraft({ ...draft, carbsG: event.target.value })}
            value={draft.carbsG}
          />
          <Input
            error={invalid.has('fatG') ? t.targetsFieldInvalid : undefined}
            inputMode="numeric"
            label={labels.labelFat}
            onChange={event => setDraft({ ...draft, fatG: event.target.value })}
            value={draft.fatG}
          />

          <div className={styles.actions}>
            <Button loading={pending} type="submit">
              {pending ? dictionary.common.saving : t.targetsSave}
            </Button>
            <Button
              disabled={pending}
              onClick={() => {
                setDraft(toDraft(targets));
                setErrors([]);
                setInvalid(new Set());
                setEditing(false);
              }}
              type="button"
              variant="secondary"
            >
              {dictionary.common.cancel}
            </Button>
            {overrideStatus === 'none' ? null : (
              <Button
                disabled={pending}
                onClick={() => void save({ carbsG: null, fatG: null, kcal: null, proteinG: null })}
                type="button"
                variant="tertiary"
              >
                {t.targetsReset}
              </Button>
            )}
          </div>
        </form>
      ) : (
        <div className={styles.actions}>
          <Button onClick={() => setEditing(true)} ref={trigger} type="button" variant="secondary">
            {t.targetsEdit}
          </Button>
        </div>
      )}
    </Card>
  );
}

function toDraft({ effective }: ResolvedTargets): Draft {
  return { carbsG: String(effective.carbsG), fatG: String(effective.fatG), kcal: String(effective.kcal), proteinG: String(effective.proteinG) };
}

/** An emptied field means "go back to the computed value", which the API reads as null. */
function toNumber(value: string): number | null {
  const trimmed = value.trim();

  return trimmed === '' ? null : Number(trimmed);
}
