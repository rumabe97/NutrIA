'use client';
import { Checkbox } from 'ui/components/Checkbox';
import { Link } from 'ui/components/Link';
import { Text } from 'ui/components/Text';
import { useDictionary, useLocale } from 'i18n/LocaleProvider';
import { VStack } from 'ui/components/VStack';
import { withLocale } from 'i18n/routes';

/** The one placeholder `profileConsent.note` carries, and the page it opens. */
const PRIVACY_PLACEHOLDER = '{privacy}';

/**
 * The explicit health-data consent (`docs/legal/textos/05-consentimientos-cliente.md`
 * § A) — the same words whether they sit inside the allergies onboarding step
 * or stand alone on the interstitial existing accounts see once.
 *
 * A presentational block only: the checkbox is uncontrolled and named
 * `profileConsentGiven`, so either caller reads it from its own `FormData` and
 * decides what "blocked" means for its own submit — the onboarding step keeps
 * marching through steps, the interstitial has nowhere else to go.
 */
export function ProfileConsentFields({ defaultChecked = false }: Readonly<{ defaultChecked?: boolean }>) {
  const dictionary = useDictionary();
  const locale = useLocale();
  const t = dictionary.profileConsent;

  return (
    <VStack gap="03">
      <Text tone="secondary">{t.body}</Text>
      <Text size="sm" tone="secondary">
        {t.ai}
      </Text>
      <Checkbox defaultChecked={defaultChecked} label={t.label} name="profileConsentGiven" required={true} />
      <Text size="xs" tone="tertiary">
        {t.note.split(/(\{privacy\})/).map(part =>
          part === PRIVACY_PLACEHOLDER ? (
            <Link href={withLocale('/privacidad', locale)} inline={true} key={part}>
              {dictionary.auth.legalPrivacy}
            </Link>
          ) : (
            part
          )
        )}
      </Text>
    </VStack>
  );
}
