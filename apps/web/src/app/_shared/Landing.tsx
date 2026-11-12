import { Fragment, useId } from 'react';

import styles from './Landing.module.css';

import { Accordion, AccordionItem } from 'ui/components/Accordion';
import { dictionaryFor } from 'i18n/server';
import { Note } from 'ui/components/Note';
import { Text } from 'ui/components/Text';
import { withLocale } from 'i18n/routes';

import { Card } from 'components/Card';
import { CtaLink } from 'components/CtaLink';
import { DishPicture } from 'components/DishPicture';
import { LandingPictures } from 'components/LandingPictures';
import { Reveal } from 'components/Reveal';
import { SiteFooter } from 'components/SiteFooter';
import { SiteHeader } from 'components/SiteHeader';

import { LANDING_PICTURES } from 'lib/landingPictures';
import { titleAccent } from 'lib/titleAccent';

import { JsonLd } from './JsonLd';
import { MAIN_ID } from './mainId';

import type { Dictionary } from 'i18n/dictionaries/es-ES';
import type { Locale } from 'i18n/config';

/**
 * The slots of the preview's four meals, in order: data, not copy. They choose the designed
 * state each row is drawn with (`lib/dishLook`) — the preview's dishes are examples and have
 * no picture, so they are drawn the way most dishes in a real plan are.
 */
const PREVIEW_SLOTS = ['breakfast', 'lunch', 'afternoon_snack', 'dinner'] as const;

/**
 * The marketing page (project 024 phase 7, `reference/03-admin-and-landing.jpg`). Its language
 * comes from the route it is mounted under, so it is built once and served from the edge.
 *
 * The hero is the sheet's: the copy at the start, the food beside it. The food is the dish
 * pictures the owner chose (`lib/landingPictures`), or — until he has, and whenever none is
 * listed — the illustrative plan, drawn the way the plan screen draws a day.
 */
export function Landing({ locale }: Readonly<{ locale: Locale }>) {
  const dictionary = dictionaryFor(locale);
  const t = dictionary.landing;
  // The header's own links are shared with the signed-in chrome and stay
  // unprefixed; these two are the page's main call to action, and a reader in
  // English should not be handed a Spanish form to fill in.
  const signUp = withLocale('/registro', locale);
  const title = titleAccent(t.title, t.titleAccent);
  const hasPictures = LANDING_PICTURES.length > 0;
  const heroTitleId = useId();

  // A static illustration of the product, deliberately: the plan screen's real structure and
  // copy, not a stock dashboard. Visibly its own card, apart from any picture (§ 2.8 W3).
  const preview = (
    <div className={styles.preview}>
      <div className={styles.previewHead}>
        {/* Not a heading: an example day is no part of the page's outline. */}
        <p className={styles.previewTitle}>{t.preview.dayOf}</p>
        <Text size="sm" tone="secondary">
          {t.preview.totals}
        </Text>
      </div>

      <ul className={`${styles.previewMeals} motion-list`}>
        {t.preview.meals.map((meal, index) => (
          <li className={styles.mealRow} key={meal.slot}>
            <span className={styles.mealLook}>
              <DishPicture slot={PREVIEW_SLOTS[index]} variant="thumb" />
            </span>
            <span className={styles.mealWords}>
              <span className={styles.mealSlot}>{meal.slot}</span>
              <span className={styles.mealName}>{meal.name}</span>
              <span className={styles.mealKcal}>{meal.kcal}</span>
            </span>
          </li>
        ))}
      </ul>

      <dl className={styles.previewStats}>
        {[
          { label: t.preview.adherence, value: t.preview.adherenceValue },
          { label: t.preview.nextReview, value: t.preview.nextReviewValue },
          { label: t.preview.shopping, value: t.preview.shoppingValue }
        ].map(stat => (
          <div className={styles.previewStat} key={stat.label}>
            <dt className={styles.previewStatLabel}>{stat.label}</dt>
            <dd className={styles.previewStatValue}>{stat.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );

  return (
    <Fragment>
      <SiteHeader />

      <main className={styles.main} id={MAIN_ID}>
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section aria-labelledby={heroTitleId} className={styles.hero}>
          <Reveal className={styles.heroCopy}>
            <p className={styles.eyebrow}>{t.eyebrow}</p>
            <h1 className={styles.display} id={heroTitleId}>
              {title.lead}
              {title.accent ? <span className={styles.accent}>{title.accent}</span> : null}
            </h1>
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

            <Text className={styles.heroNote} size="sm" tone="secondary">
              {t.heroNote}
            </Text>
          </Reveal>

          <Reveal className={styles.heroVisual} delay={120}>
            {hasPictures ? <LandingPictures caption={t.heroPicturesNote} pictures={LANDING_PICTURES} /> : preview}
          </Reveal>
        </section>

        {/* ── What a plan is, in three tiles ───────────────────────────── */}
        <ul className={`${styles.highlights} motion-list`}>
          {t.highlights.map(item => (
            <li className={styles.highlight} key={item.title}>
              <span className={styles.highlightTitle}>{item.title}</span>
              <span className={styles.highlightBody}>{item.body}</span>
            </li>
          ))}
        </ul>

        {/* With pictures in the hero, the illustrative plan follows it on its own. */}
        {hasPictures ? (
          <div className={styles.previewAlone}>
            <Reveal>{preview}</Reveal>
          </div>
        ) : null}

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
                <Card>
                  <h3 className={`${styles.subheading} ${styles.featureTitle}`}>{feature.title}</h3>
                  <Text size="sm" tone="secondary">
                    {feature.body}
                  </Text>
                </Card>
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
                  <Reveal delay={index * 80} key={item.title}>
                    {/* A flat note, not a card: a promise set apart from the prose. No tone word —
                        nothing here is a warning or a state, and its heading says what it is. */}
                    <Note>
                      <h3 className={styles.subheading}>{item.title}</h3>
                      <Text size="sm" tone="secondary">
                        {item.body}
                      </Text>
                    </Note>
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
          <Reveal className={styles.finalCard}>
            <h2 className={`${styles.headline} ${styles.finalTitle}`}>{t.finalCtaTitle}</h2>
            <Text className={styles.finalLede} tone="secondary">
              {t.finalLede}
            </Text>
            <div className={styles.finalActions}>
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
    mainEntity: faq.map(item => ({ '@type': 'Question', acceptedAnswer: { '@type': 'Answer', text: item.answer }, name: item.question }))
  };
}
