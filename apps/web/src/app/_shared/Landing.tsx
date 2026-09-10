import { Fragment } from 'react';

import styles from './Landing.module.css';

import { Accordion, AccordionItem } from 'ui/components/Accordion';
import { dictionaryFor } from 'i18n/server';
import { Text } from 'ui/components/Text';
import { withLocale } from 'i18n/routes';

import { CtaLink } from 'components/CtaLink';
import { Reveal } from 'components/Reveal';
import { SiteFooter } from 'components/SiteFooter';
import { SiteHeader } from 'components/SiteHeader';

import { JsonLd } from './JsonLd';
import { MAIN_ID } from './mainId';

import type { Dictionary } from 'i18n/dictionaries/es-ES';
import type { Locale } from 'i18n/config';

/** The marketing page. Its language comes from the route it is mounted under, so it can be built once and served from the edge. */
export function Landing({ locale }: Readonly<{ locale: Locale }>) {
  const dictionary = dictionaryFor(locale);
  const t = dictionary.landing;
  // The header's own links are shared with the signed-in chrome and stay
  // unprefixed; these two are the page's main call to action, and a reader in
  // English should not be handed a Spanish form to fill in.
  const signUp = withLocale('/registro', locale);

  return (
    <Fragment>
      <SiteHeader />

      <main className={styles.main} id={MAIN_ID}>
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section className={styles.hero}>
          <Reveal>
            <span className={styles.eyebrow}>{t.eyebrow}</span>
            <h1 className={styles.display}>{t.title}</h1>
            <Text className={styles.lede} tone="secondary">
              {t.lede}
            </Text>

            <div className={styles.heroActions}>
              <CtaLink href={signUp} size="lg">
                {t.ctaPrimary}
              </CtaLink>
              <CtaLink href="#como-funciona" size="lg" variant="secondary">
                {t.ctaSecondary}
              </CtaLink>
            </div>

            <Text className={styles.heroNote} size="sm" tone="tertiary">
              {t.heroNote}
            </Text>
          </Reveal>

          {/* A static illustration of the product, deliberately: it is the plan
              screen's real structure and copy, not a stock dashboard. */}
          <Reveal className={styles.preview} delay={120}>
            <div className={styles.previewBar}>
              <Text size="sm" weight="medium">
                {t.preview.dayOf}
              </Text>
              <Text size="sm" tone="tertiary">
                {t.preview.totals}
              </Text>
            </div>

            <div className={styles.previewBody}>
              {t.preview.meals.map(meal => (
                <div className={styles.mealRow} key={meal.slot}>
                  <Text size="sm" tone="tertiary">
                    {meal.slot}
                  </Text>
                  <Text size="sm">{meal.name}</Text>
                  <Text size="sm" tone="tertiary">
                    {meal.kcal}
                  </Text>
                </div>
              ))}
            </div>

            <div className={styles.previewStats}>
              {[
                { label: t.preview.adherence, value: t.preview.adherenceValue },
                { label: t.preview.nextReview, value: t.preview.nextReviewValue },
                { label: t.preview.shopping, value: t.preview.shoppingValue }
              ].map(stat => (
                <div key={stat.label}>
                  <Text size="lg" weight="semibold">
                    {stat.value}
                  </Text>
                  <Text size="xs" tone="tertiary">
                    {stat.label}
                  </Text>
                </div>
              ))}
            </div>
          </Reveal>
        </section>

        {/* ── How it works ─────────────────────────────────────────────── */}
        <section className={styles.section} id="como-funciona">
          <Reveal>
            <h2 className={styles.headline}>{t.stepsTitle}</h2>
            <Text className={styles.sectionLede} tone="secondary">
              {t.stepsLede}
            </Text>
          </Reveal>

          <div className={styles.steps}>
            {t.steps.map((step, index) => (
              <Reveal className={styles.step} delay={index * 80} key={step.title}>
                <h3 className={styles.subheading}>{step.title}</h3>
                <Text size="sm" tone="secondary">
                  {step.body}
                </Text>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── Personalisation ──────────────────────────────────────────── */}
        <section className={styles.section} id="personalizacion">
          <Reveal>
            <h2 className={styles.headline}>{t.personalisationTitle}</h2>
            <Text className={styles.sectionLede} tone="secondary">
              {t.personalisationLede}
            </Text>
          </Reveal>

          <div className={styles.features}>
            {t.features.map((feature, index) => (
              <Reveal className={styles.feature} delay={index * 60} key={feature.title}>
                <h3 className={`${styles.subheading} ${styles.featureTitle}`}>{feature.title}</h3>
                <Text size="sm" tone="secondary">
                  {feature.body}
                </Text>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── Safety ───────────────────────────────────────────────────── */}
        <section id="seguridad">
          <div className={styles.safety}>
            <div className={styles.safetyInner}>
              <Reveal>
                <h2 className={styles.headline}>{t.safetyTitle}</h2>
                <Text className={styles.sectionLede} tone="secondary">
                  {t.safetyLede}
                </Text>
              </Reveal>

              <div className={styles.safetyGrid}>
                {t.safety.map((item, index) => (
                  <Reveal className={styles.safetyItem} delay={index * 80} key={item.title}>
                    <h3 className={styles.subheading}>{item.title}</h3>
                    <Text size="sm" tone="secondary">
                      {item.body}
                    </Text>
                  </Reveal>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── FAQ ──────────────────────────────────────────────────────── */}
        <section className={styles.section} id="preguntas">
          <Reveal>
            <h2 className={styles.headline}>{t.faqTitle}</h2>
          </Reveal>

          <Reveal className={styles.faq}>
            <Accordion collapsible={true} type="single">
              {t.faq.map(item => (
                <AccordionItem key={item.question} trigger={item.question} value={item.question}>
                  {item.answer}
                </AccordionItem>
              ))}
            </Accordion>
          </Reveal>

          {/* Built from the same array the accordion above renders, so the
              markup a search engine reads and the words a visitor reads cannot
              disagree — which is the one thing Google's FAQ guidance is
              actually strict about. */}
          <JsonLd data={faqSchema(t.faq)} />
        </section>

        {/* ── Final CTA ────────────────────────────────────────────────── */}
        <section className={styles.finalCta}>
          <Reveal>
            <h2 className={styles.headline} style={{ marginInline: 'auto' }}>
              {t.finalCtaTitle}
            </h2>
            <Text className={styles.lede} tone="secondary">
              {t.finalLede}
            </Text>
            <div className={styles.heroActions}>
              <CtaLink href={signUp} size="lg">
                {t.ctaPrimary}
              </CtaLink>
            </div>
          </Reveal>
        </section>
      </main>

      <SiteFooter />
    </Fragment>
  );
}

/** The questions on the page, as the shape schema.org wants them in. */
function faqSchema(faq: Dictionary['landing']['faq']): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map(item => ({
      '@type': 'Question',
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
      name: item.question
    }))
  };
}
