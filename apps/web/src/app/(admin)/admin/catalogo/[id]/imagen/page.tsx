import { notFound } from 'next/navigation';
import Link from 'next/link';

import styles from './page.module.css';

import { activeLocale, getDictionary } from 'i18n/server';
import { Text } from 'ui/components/Text';

import { AdminPageHeader } from 'components/AdminPageHeader';
import { AdminSection } from 'components/AdminSection';
import { Card } from 'components/Card';
import { DishPicture } from 'components/DishPicture';
import { EmptyState } from 'components/EmptyState';
import { PictureCandidateAction, REVIEW_BACK_ID, REVIEW_STATUS_ID } from 'components/PictureCandidateAction';

import { formatInstant, formatNumber, interpolate } from 'lib/format';
import { serverApi } from 'lib/server-api';

import { consoleMetadata } from '../../../consoleMetadata';

import type { AdminRecipeView } from 'core/controllers/Admin';
import type { Allergen } from 'core/entities/Safety';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return consoleMetadata('/admin/catalogo/[id]/imagen');
}

const RECIPES = '/admin/catalogo';

/**
 * Recetas › the review of one rejected picture (`0072`): the picture the judge turned down,
 * large and marked as made by AI, beside what the dish is made of and what the judge
 * flagged — allergen labels and catalogue ingredients, never the vision model's own words.
 * Until it expires the owner can discard it or retry the drawing, which deletes it too.
 *
 * The file is read through the API with the admin's session; no address of it is in any
 * answer. A recipe that holds no picture to look at says so, and an id that is no recipe
 * is the console's 404. A dish, never a person (`0028`).
 */
export default async function AdminPictureReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [dictionary, locale, recipe, allergens] = await Promise.all([
    getDictionary(),
    activeLocale(),
    serverApi<AdminRecipeView>(`/admin/catalogue/recipes/${encodeURIComponent(id)}`),
    serverApi<readonly Allergen[]>('/safety/allergens')
  ]);

  if (!recipe) {
    notFound();
  }

  const t = dictionary.adminPictureReview;
  const candidate = recipe.pictureCandidate;
  const allergenName = new Map((allergens ?? []).map(allergen => [allergen.key, allergen.labelEs]));
  // The catalogue names allergens and ingredients in Spanish only: marked so, for a screen reader on the English page.
  const names = (values: readonly string[]): ReactNode => (values.length === 0 ? t.none : <span lang="es">{values.join(', ')}</span>);
  const labels = (keys: readonly string[]) => keys.map(key => allergenName.get(key) ?? key);
  const grams = (value: number) => `${formatNumber(value, locale, { maximumFractionDigits: 0 })} ${dictionary.units.gram}`;

  return (
    <div className={styles.page}>
      <p className={styles.back}>
        <Link className={styles.link} href={RECIPES} id={REVIEW_BACK_ID}>
          {t.back}
        </Link>
      </p>
      <p className="visually-hidden" id={REVIEW_STATUS_ID} role="status" />

      <AdminPageHeader
        intro={candidate ? t.intro : interpolate(t.introNothing, { state: dictionary.adminRecipes.pictures[recipe.picture] })}
        title={interpolate(t.title, { dish: recipe.name })}
      />

      {candidate ? (
        <div className={styles.review}>
          <AdminSection title={t.pictureTitle}>
            <figure className={styles.figure}>
              <DishPicture
                alt={interpolate(t.pictureAlt, { dish: recipe.name })}
                path={`/admin/catalogue/recipes/${encodeURIComponent(recipe.id)}/picture/candidate`}
                priority={true}
                variant="hero"
              />
              <figcaption className={styles.caption}>{t.pictureCaption}</figcaption>
              <p className={styles.loadFailed}>{t.loadFailed}</p>
            </figure>
          </AdminSection>

          <div className={styles.facts}>
            <AdminSection note={t.flaggedNote} title={t.flaggedTitle}>
              <Card as="dl" className={styles.list}>
                <div>
                  <dt>{t.flaggedAllergens}</dt>
                  {/* None flagged is not a verdict on the picture: said in words, never as a bare "none". */}
                  <dd>{candidate.allergens.length === 0 ? t.flaggedAllergensNone : names(labels(candidate.allergens))}</dd>
                </div>
                <div>
                  <dt>{t.flaggedIngredients}</dt>
                  <dd>{names(candidate.ingredients.map(ingredient => ingredient.name))}</dd>
                </div>
              </Card>
            </AdminSection>

            <AdminSection title={t.dishTitle}>
              <Card as="dl" className={styles.list}>
                <div>
                  <dt>{t.dishAllergens}</dt>
                  <dd>{names(labels(recipe.allergens))}</dd>
                </div>
                <div>
                  <dt>{t.dishTraces}</dt>
                  <dd>{names(labels(recipe.mayContain))}</dd>
                </div>
                <div>
                  <dt>{t.ingredients}</dt>
                  <dd>
                    {recipe.ingredients.length === 0 ? (
                      t.none
                    ) : (
                      <ul className={styles.ingredients} lang="es" role="list">
                        {recipe.ingredients.map(ingredient => (
                          <li key={ingredient.slug}>
                            <span>{ingredient.name}</span>
                            <span className={styles.grams}>{grams(ingredient.grams)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </dd>
                </div>
              </Card>
            </AdminSection>
          </div>

          <div className={styles.decide}>
            <AdminSection
              note={interpolate(t.decideNote, {
                date: formatInstant(Date.parse(candidate.expiresAt), locale, {
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  month: 'long',
                  timeZone: 'Europe/Madrid'
                })
              })}
              title={t.decideTitle}
            >
              <Text className={styles.help}>{t.decideHelp}</Text>
              <div className={styles.actions}>
                <PictureCandidateAction kind="discard" recipeId={recipe.id} />
                <PictureCandidateAction kind="retry" recipeId={recipe.id} />
              </div>
            </AdminSection>
          </div>
        </div>
      ) : (
        <EmptyState body={t.nothingBody} title={t.nothingTitle} />
      )}
    </div>
  );
}
