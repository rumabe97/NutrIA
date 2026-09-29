import { z } from 'zod';

import { INGREDIENT_CATEGORIES, MEAL_SLOTS } from 'core/entities/Plan';
import { pictureStatusSchema } from 'core/entities/DishPicture';
import { PERIODS } from 'core/entities/Period';

/**
 * The query strings of the console's three people tables (`0068`): accounts,
 * the inbox and the professionals. Each is a Zod schema because the API binds
 * it as a query DTO, and a DTO's schema lives here.
 *
 * Every sort column is an allow-list: anything else is refused before a query
 * runs (422 `INVALID_INPUT`), so a column name never travels from a URL into
 * SQL. A value repeated in the URL arrives as an array and is refused too.
 */

/** Which way a column sorts. `desc` when absent: the useful end is the recent one. */
export const SORT_DIRECTIONS = ['asc', 'desc'] as const;

export type SortDirection = (typeof SORT_DIRECTIONS)[number];

/** The page sizes the console offers. The API accepts any size from 1 to `MAX_PAGE_SIZE`. */
export const PAGE_SIZES = [25, 50, 100] as const;

export const DEFAULT_PAGE_SIZE = 25;

export const MAX_PAGE_SIZE = 100;

/** Far past any real list, short of anything that would stop being an integer. */
const MAX_OFFSET = 1_000_000;

/** Long enough for any address, short enough that a pasted page is refused. */
export const MAX_SEARCH_LENGTH = 200;

/** A two-way filter as the URL says it. Absent means "either". */
export const YES_NO = ['yes', 'no'] as const;

export type YesNo = (typeof YES_NO)[number];

const yesNo = z.enum(YES_NO).optional();

/**
 * Free text to look for, as a literal "contains". Blank is the same as absent. A NUL
 * character is refused here: Postgres cannot hold one in text, and would answer a 500.
 */
const search = z
  .string()
  .trim()
  .max(MAX_SEARCH_LENGTH)
  .refine(text => !text.includes('\u0000'), { message: 'A search cannot contain a NUL character' })
  .optional()
  .transform(text => (text === '' ? undefined : text));

const direction = z.enum(SORT_DIRECTIONS).default('desc');

const offset = z.coerce.number().int().min(0).max(MAX_OFFSET).default(0);

const size = z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE);

/** The columns the account table sorts by. */
export const ACCOUNT_SORTS = ['createdAt', 'email', 'lastActiveAt', 'plans'] as const;

export type AccountSort = (typeof ACCOUNT_SORTS)[number];

/**
 * `GET /admin/accounts`: search by address, filter by the two locks, the
 * milestones, the tier and the role, sort, page. Every filter is about the
 * account — never about what it eats or its profile (`0028`).
 */
export const accountQuerySchema = z.object({
  activated: yesNo,
  confirmed: yesNo,
  dir: direction,
  offset,
  onboarded: yesNo,
  professional: yesNo,
  q: search,
  role: z.enum(['admin', 'user']).optional(),
  size,
  sort: z.enum(ACCOUNT_SORTS).default('createdAt'),
  tier: z.enum(['free', 'premium']).optional()
});

export type AccountQuery = z.infer<typeof accountQuerySchema>;

/** Which messages the inbox shows: every one, the ones still waiting, or the ones marked seen. */
export const FEEDBACK_STATES = ['all', 'waiting', 'seen'] as const;

export type FeedbackState = (typeof FEEDBACK_STATES)[number];

export const FEEDBACK_SORTS = ['createdAt'] as const;

/** `GET /admin/feedback`: search the message or the sender's address, filter by state, sort by date, page. */
export const feedbackQuerySchema = z.object({
  dir: direction,
  offset,
  q: search,
  size,
  sort: z.enum(FEEDBACK_SORTS).default('createdAt'),
  state: z.enum(FEEDBACK_STATES).default('all')
});

export type FeedbackQuery = z.infer<typeof feedbackQuerySchema>;

/** `links` sorts by active links, then by every link. */
export const PROFESSIONAL_SORTS = ['grantedAt', 'email', 'links'] as const;

export type ProfessionalSort = (typeof PROFESSIONAL_SORTS)[number];

/** `GET /admin/professionals`: search by address and sort. Unpaged: there are few. */
export const professionalQuerySchema = z.object({ dir: direction, q: search, sort: z.enum(PROFESSIONAL_SORTS).default('grantedAt') });

export type ProfessionalQuery = z.infer<typeof professionalQuerySchema>;

// ─── The generation log and the catalogue ────────────────────────────────────

/** Every state a generation job can be in. Mirrors the `job_status` enum; a spec pins the two together. */
export const GENERATION_STATUSES = ['queued', 'running', 'succeeded', 'failed'] as const;
export type GenerationStatus = (typeof GENERATION_STATUSES)[number];

/** How far back the log looks: the last 24 hours, or a console period in days. */
export const GENERATION_SINCE = ['24h', ...PERIODS.map(String)] as [string, ...string[]];

/**
 * A failure code as the pipeline writes it — `GENERATION_AI_UNAVAILABLE` and
 * its kin: capitals, digits and underscores. Matched exactly, never searched.
 */
const failureCode = z
  .string()
  .regex(/^[A-Z][A-Z0-9_]{0,79}$/)
  .optional();

/** A Madrid calendar day, `YYYY-MM-DD`. */
const day = z.iso.date().optional();

/**
 * `GET /admin/generations`: filter by outcome and failure code, search the
 * account's address (`q`, which the request log redacts), narrow to the last
 * 24 hours or a period and to a range of Madrid days (`from` and `to`, both
 * inclusive), and page. Every filter given applies. A range that ends before
 * it starts is refused.
 */
export const generationQuerySchema = z
  .object({
    code: failureCode,
    from: day,
    offset,
    q: search,
    since: z.enum(GENERATION_SINCE).optional(),
    size,
    status: z.enum(GENERATION_STATUSES).optional(),
    to: day
  })
  .refine(query => query.from === undefined || query.to === undefined || query.from <= query.to, {
    message: '`from` must not be after `to`',
    path: ['from']
  });

export type GenerationQuery = z.infer<typeof generationQuerySchema>;

/** Where a recipe came from. Mirrors the `recipe_source` enum; a spec pins the two together. */
export const RECIPE_SOURCES = ['seed', 'ai', 'user'] as const;
export type RecipeSource = (typeof RECIPE_SOURCES)[number];

/**
 * The recipe table's sorts: by name, or by the macros per serving the app
 * computes (`core/domain/Composition`). There is no `createdAt`: `recipes`
 * records no creation time, and a stand-in would be a guess.
 */
export const RECIPE_SORTS = ['name', 'kcal', 'protein'] as const;
export type RecipeSort = (typeof RECIPE_SORTS)[number];

/**
 * Recetas' quality filters (`0071`, Catálogo › Calidad): the recipes each
 * "should be zero" count and each "to look at" count is made of, so the count
 * can link to the table with the filter set. Each is a question the app's own
 * helpers answer (`core/domain/CatalogueQuality`), never a formula of the
 * console's.
 *
 * - `over_bound`: one serving past `OVERSIZED_FACTOR` times its meals' cap;
 * - `uncosted`: macros the catalogue cannot compute;
 * - `unserved`: no meal fits every ingredient of the dish, so it is never served;
 * - `refusal_limit`: the rewrite sweep gave up on it under the current steps version;
 * - `over_cap`: past its meals' cap but within the bound.
 */
export const RECIPE_CHECKS = ['over_bound', 'uncosted', 'unserved', 'refusal_limit', 'over_cap'] as const;
export type RecipeCheck = (typeof RECIPE_CHECKS)[number];

/** An allergen's stable key, as `allergens.key` holds it (`gluten`, `tree_nuts`). An unknown key matches nothing. */
const allergenKey = z
  .string()
  .regex(/^[a-z][a-z_]{0,39}$/)
  .optional();

/** A catalogue reads from the start of the alphabet unless asked otherwise. */
const ascending = z.enum(SORT_DIRECTIONS).default('asc');

/**
 * `GET /admin/catalogue/recipes`: search by name, filter by meal slot, a quality check, an
 * allergen the recipe contains, its picture's state, its source and its
 * locale, sort, page. The catalogue names no person (`0028`).
 */
export const recipeCatalogueQuerySchema = z.object({
  allergen: allergenKey,
  check: z.enum(RECIPE_CHECKS).optional(),
  dir: ascending,
  locale: z
    .string()
    .regex(/^[a-z]{2,3}(-[A-Z]{2})?$/)
    .optional(),
  offset,
  picture: pictureStatusSchema.optional(),
  q: search,
  size,
  slot: z.enum(MEAL_SLOTS).optional(),
  sort: z.enum(RECIPE_SORTS).default('name'),
  source: z.enum(RECIPE_SOURCES).optional()
});

export type RecipeCatalogueQuery = z.infer<typeof recipeCatalogueQuerySchema>;

/** The ingredient table's sorts: its name, its category, or a figure per 100 g. */
export const INGREDIENT_SORTS = ['name', 'category', 'kcal', 'protein', 'carbs', 'fat'] as const;
export type IngredientSort = (typeof INGREDIENT_SORTS)[number];

/** `GET /admin/catalogue/ingredients`: search by name, filter by category and by an allergen it contains, sort, page. */
export const ingredientCatalogueQuerySchema = z.object({
  allergen: allergenKey,
  category: z.enum(INGREDIENT_CATEGORIES).optional(),
  dir: ascending,
  offset,
  q: search,
  size,
  sort: z.enum(INGREDIENT_SORTS).default('name')
});

export type IngredientCatalogueQuery = z.infer<typeof ingredientCatalogueQuerySchema>;
