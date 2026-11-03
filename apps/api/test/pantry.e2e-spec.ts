import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';

import { ACCOMPANIMENTS } from 'core/domain/Accompaniment';
import { database } from 'database';
import { MAX_PANTRY_ITEMS, MAX_PANTRY_LABEL_LENGTH } from 'core/entities/Pantry';
import { PANTRY_CATALOGUE_PAGE } from 'core/controllers/Pantry';
import { SettingsController } from 'core/controllers/Settings';
import { toDry } from 'core/domain/Yield';
import { UNAUDITED } from 'core/entities/Audit';
import { UserController } from 'core/controllers/User';

import { createApp, deleteAccounts, giveProfileConsent, httpServer, PREFIX, register, ScriptedAiClient } from './harness.js';

import type { Account } from './harness.js';
import type { INestApplication } from '@nestjs/common';
import type { PantryCatalogueFoodView, PantryView } from 'core/controllers/Pantry';
import type { Response } from 'supertest';

/**
 * What somebody says is already in the house, typed before a fortnight is asked
 * for (project 022, phase 1).
 *
 * Four things here are not visible from a unit test, and each of them is why
 * this file exists:
 *
 *  1. **A denial is a 404, byte for byte the answer an id nobody owns gets**
 *     (`0019`). Over HTTP, through the real filter, which is the only place the
 *     bytes two accounts are handed can be compared.
 *  2. **Sixty is a ceiling and not a price** (PRD 022, criterion 11): the same
 *     bound on a free account and on a premium one, and the refusal is a 422
 *     naming `label` whose body does **not** carry the word that was typed
 *     (criterion 7).
 *  3. **Resolution runs against the real catalogue**, so a coarse word lands on
 *     the dry food a shopping list is written against (`0078`) and a word
 *     nothing answers is kept with `slug: null` rather than dropped.
 *  4. **No `@RequiresOnboarding()`**: no account here completes onboarding, so a
 *     guard added to these routes turns this whole file red.
 *
 * And three more since phase 3a, each about the picker the screen reads:
 *
 *  5. **What the picker offers is what an add resolves to**, asked of every row
 *     of a whole answer over HTTP and through the real catalogue — the one
 *     failure `POST /pantry/catalogue` exists to prevent.
 *  6. **The word travels in a body**, and there is no `GET` with it in a query
 *     string (`legal`'s P1-1; `0100`). A case holds that absence in place.
 *  7. **`cookedWith` is a sentence and never a restriction**, told apart from
 *     `slug: null`, true through the dry/cooked mapping and true for a food the
 *     library only serves beside a plate — each on a food chosen from the
 *     library this run actually has, because CI's is ten times smaller.
 *
 * The model is never called — nothing here generates — so the pool is empty on
 * purpose. Requires a real database and a seeded catalogue — see ./README.md.
 */

/** A word no catalogue could hold, so the entry it makes resolves to nothing. */
const UNKNOWN = 'zzxqv de plutonia';

type Sql = <Row>(strings: TemplateStringsArray, ...values: readonly unknown[]) => Promise<Row[]>;

/** Parameterised reads of what no route returns, as `generation.e2e-spec.ts` does them. */
function sql(): Sql {
  return (database() as unknown as { readonly $client: Sql }).$client;
}

/** One catalogue food as this suite needs it: the word to type, and what typing it must land on. */
type Food = { readonly name: string; readonly slug: string };

/** By the word that was typed, so two lists of entries are comparable at all: a cupboard is a set and not a sequence. */
function byLabel(a: { readonly label: string }, b: { readonly label: string }): number {
  return a.label.localeCompare(b.label);
}

/**
 * Every food this library serves **beside** a plate, as `domain/Pantry`'s own
 * `SERVED_BESIDE` builds it — a code constant, so it is the same here, in CI and
 * in production.
 *
 * It is here to be **excluded**. A side is `cookedWith: true` whatever the
 * recipes say, so a food that is one cannot prove anything about the plate
 * counts or about the dry/cooked mapping, and a case built on one would pass
 * with either rule. `arroz-largo-crudo` is exactly that trap: it is the food
 * *«tengo arroz»* resolves to and the plan's own example of the mapping, and it
 * is also an ingredient of the `arroz-blanco` and `arroz-rojo` accompaniments,
 * so the mapped food this suite tests with is chosen at run time from the ones
 * that are not.
 */
const SERVED_BESIDE: ReadonlySet<string> = new Set(
  ACCOMPANIMENTS.flatMap(side =>
    side.portions.flat().flatMap(item => {
      const dry = toDry(item.slug, 0)?.drySlug;

      return dry === undefined || dry === null ? [item.slug] : [item.slug, dry];
    })
  )
);

/**
 * Every slug some recipe of this library lists, read at run time.
 *
 * At run time and never hard-coded: the end-to-end database keeps the dishes
 * every scripted suite before this one wrote, and this machine's library holds
 * about 1,100 dishes against CI's ~90, so which foods are cooked with is not a
 * fact a fixture may state. Counted the way `platesByIngredient` counts —
 * `recipe_ingredients`, optional rows included — because that is the map
 * `cookedWith` is asked of.
 */
async function platedSlugs(): Promise<ReadonlySet<string>> {
  const rows = await sql()<{ slug: string }>`
    select distinct ingredients.slug
    from recipe_ingredients
    join ingredients on ingredients.id = recipe_ingredients.ingredient_id`;

  return new Set(rows.map(row => row.slug));
}

/** The Spanish name of each of these slugs, which is a word `resolvePantryLabel` answers directly. */
async function namesOf(slugs: readonly string[]): Promise<ReadonlyMap<string, string>> {
  const rows = await sql()<Food>`
    select ingredient_names.name, ingredients.slug
    from ingredients
    join ingredient_names on ingredient_names.ingredient_id = ingredients.id and ingredient_names.locale = 'es-ES'
    where ingredients.slug = any(${[...slugs]})`;

  return new Map(rows.map(row => [row.slug, row.name]));
}

describe('a cupboard a person types', () => {
  let app: INestApplication;
  /** Every account this suite registered, so `afterAll` can delete each one. */
  const made: string[] = [];
  const stamp = Date.now();

  const pantryOf = (response: Response): PantryView => response.body as PantryView;

  const add = (who: Account, body: Record<string, unknown>) =>
    request(httpServer(app)).post(`/${PREFIX}/pantry`).set('Cookie', who.cookie).send(body);

  const read = (who: Account) => request(httpServer(app)).get(`/${PREFIX}/pantry`).set('Cookie', who.cookie);

  const drop = (who: Account, id: string) => request(httpServer(app)).delete(`/${PREFIX}/pantry/${id}`).set('Cookie', who.cookie);

  const empty = (who: Account) => request(httpServer(app)).delete(`/${PREFIX}/pantry`).set('Cookie', who.cookie);

  /** The picker's own route: a **POST** carrying the word, which is a privacy decision and not a REST one (`0100`). */
  const offered = (who: Account, body: Record<string, unknown>, locale?: string) => {
    const call = request(httpServer(app)).post(`/${PREFIX}/pantry/catalogue`).set('Cookie', who.cookie);

    return (locale === undefined ? call : call.set('Accept-Language', locale)).send(body);
  };

  const foods = (response: Response): readonly PantryCatalogueFoodView[] => response.body as readonly PantryCatalogueFoodView[];

  /** An account with nothing but its two locks open: no profile, no onboarding, no plan. */
  const newcomer = async (label: string): Promise<Account> => {
    const account = await register(app, `pantry-${label}-${stamp}@e2e.invalid`);

    made.push(account.cookie);

    return account;
  };

  beforeAll(async () => {
    app = await createApp(new ScriptedAiClient([]));
  });

  afterAll(async () => {
    await deleteAccounts(app, made);
    await app?.close();
  });

  describe('what a word resolves to, and what happens when it resolves to nothing', () => {
    it('keeps a word the catalogue answers and a word it has never heard of, in the order they were typed', async () => {
      // Registered and nothing more: the cupboard is readable before a profile
      // exists, which is the absence of `@RequiresOnboarding()` asserted rather
      // than described.
      const who = await newcomer('resolution');

      expect(pantryOf(await read(who).expect(200))).toEqual({ items: [], maxItems: MAX_PANTRY_ITEMS });

      const first = await add(who, { grams: 200, label: 'merluza', unit: 'g' });

      expect(first.status).toBe(201);

      const second = await add(who, { label: UNKNOWN });

      expect(second.status).toBe(201);

      const after = pantryOf(await read(who).expect(200));

      expect(after.maxItems).toBe(MAX_PANTRY_ITEMS);
      // `created_at`, so the list reads back the way it was typed. The
      // unresolved entry is second here and second in the body, which is the
      // claim: nothing reorders by label, and nothing sorts the unmatched to
      // the end.
      expect(after.items.map(item => ({ grams: item.grams, label: item.label, slug: item.slug, unit: item.unit }))).toEqual([
        { grams: 200, label: 'merluza', slug: 'merluza', unit: 'g' },
        // Kept, with the word the person used, and shown as not recognised —
        // never aggregated away into a count of what matched (criterion 12).
        { grams: null, label: UNKNOWN, slug: null, unit: null }
      ]);
      expect(after.items.every(item => typeof item.id === 'string' && item.id.length > 0)).toBe(true);
    }, 60_000);

    it('resolves a coarse word to the dry thing a shopping list is written against', async () => {
      const who = await newcomer('coarse');

      // *«tengo arroz»* over sixteen rice rows. Without the coarse map this
      // resolves to nothing and covers no shopping row, which is the whole of
      // what the feature does — so `slug: null` here would be a pass of the
      // test above and a failure of the feature.
      const said = await add(who, { label: 'Arroz' });

      expect(said.status).toBe(201);
      // The dry form, because a fortnight's list merges cooked and dry into one
      // row named after the dry food (`0078`).
      expect(pantryOf(said).items.map(item => item.slug)).toEqual(['arroz-largo-crudo']);
    }, 60_000);

    it('writes the second amount over the first and still holds one thing', async () => {
      const who = await newcomer('restated');

      expect(pantryOf(await add(who, { grams: 500, label: 'lentejas', unit: 'g' })).items).toHaveLength(1);

      // The same word again, spelt as somebody would type it twice. There is no
      // route to edit a cupboard, so saying it again is how an amount is
      // corrected — not a second row, and not a refusal.
      const again = await add(who, { grams: 1000, label: '  Lentejas ', unit: 'g' });

      expect(again.status).toBe(201);
      expect(pantryOf(again).items.map(item => ({ grams: item.grams, slug: item.slug }))).toEqual([{ grams: 1000, slug: 'lentejas-secas' }]);

      const after = pantryOf(await read(who).expect(200));

      expect(after.items).toHaveLength(1);
      expect(after.items[0]?.grams).toBe(1000);
    }, 60_000);

    it('re-states a word nothing answers without making a second row of it', async () => {
      const who = await newcomer('restated-unknown');

      await add(who, { grams: 100, label: UNKNOWN, unit: 'g' }).then(response => expect(response.status).toBe(201));

      // The unresolved half of the rule: two entries that resolve to nothing are
      // the same thing when the normalised word is the same, which is the
      // partial unique index asked over HTTP.
      const again = await add(who, { grams: 250, label: UNKNOWN.toUpperCase(), unit: 'g' });

      expect(again.status).toBe(201);
      expect(pantryOf(again).items.map(item => ({ grams: item.grams, label: item.label, slug: item.slug }))).toEqual([
        { grams: 250, label: UNKNOWN.toUpperCase(), slug: null }
      ]);
    }, 60_000);
  });

  describe("one account's cupboard is unreachable from another's session (0019)", () => {
    let alice: Account;
    let bob: Account;
    let bobsEntry: string;

    beforeAll(async () => {
      alice = await newcomer('alice');
      bob = await newcomer('bob');

      const bobs = await add(bob, { grams: 300, label: 'merluza', unit: 'g' });

      expect(bobs.status).toBe(201);
      bobsEntry = pantryOf(bobs).items[0]?.id as string;
    }, 60_000);

    it("answers another account's entry with the same bytes as an id nobody owns", async () => {
      const theirs = await drop(alice, bobsEntry);
      // A uuid that belongs to nobody: the answer every id this account does not
      // own has to be indistinguishable from.
      const nobodys = await drop(alice, '00000000-0000-4000-8000-000000000000');

      expect({ status: theirs.status }).toEqual({ status: 404 });
      expect(nobodys.status).toBe(404);
      // Byte for byte, not merely the same status: a different message, a
      // different code or an extra field would let an id confirm that somebody
      // else's cupboard holds it.
      expect(theirs.text).toEqual(nobodys.text);
      expect(theirs.body).toEqual(nobodys.body);

      // And the refusal did not quietly delete it either.
      const bobs = pantryOf(await read(bob).expect(200));

      expect(bobs.items.map(item => item.id)).toEqual([bobsEntry]);
    }, 60_000);

    it("never shows one account the other's word", async () => {
      await add(alice, { label: UNKNOWN }).then(response => expect(response.status).toBe(201));

      const alices = pantryOf(await read(alice).expect(200));
      const bobs = pantryOf(await read(bob).expect(200));

      // The typed label goes back to the person who typed it and nowhere else
      // (criterion 7): it is in their own read, and in no other account's.
      expect(alices.items.map(item => item.label)).toEqual([UNKNOWN]);
      expect(bobs.items.map(item => item.label)).toEqual(['merluza']);
    }, 60_000);

    it('refuses an id that is not a uuid before it reaches the cupboard', async () => {
      // `ParseUUIDPipe`: a malformed id is a malformed request and not a lookup,
      // so nothing is read with it.
      expect((await drop(alice, 'not-a-uuid')).status).toBe(400);
    }, 60_000);
  });

  describe('the bound on how many things may be named (PRD 022, criterion 11)', () => {
    /** The word the sixty-first request types — distinctive, so its absence from the refusal is checkable. */
    const TOO_MANY = 'morcilla de zzxqv';

    /**
     * Fills a cupboard to the brim with words nothing answers, then types one
     * more and answers the refusal.
     *
     * Unresolved words on purpose: sixty entries that each resolve to a
     * catalogue row would need sixty distinct rows and would be testing the
     * catalogue, while sixty words the catalogue has no answer for are sixty
     * rows by the normalised label alone — which is what the bound counts.
     */
    const fillAndOverflow = async (who: Account): Promise<Response> => {
      for (let index = 0; index < MAX_PANTRY_ITEMS; index++) {
        const response = await add(who, { grams: 100, label: `zzxqv ${index}`, unit: 'g' });

        expect({ index, status: response.status }).toEqual({ index, status: 201 });
      }

      expect(pantryOf(await read(who).expect(200)).items).toHaveLength(MAX_PANTRY_ITEMS);

      return add(who, { label: TOO_MANY });
    };

    /** The refusal read the way `kitchen.e2e-spec.ts` reads its own: status, code and the field named. */
    const refusal = (response: Response) => {
      const body = response.body as { code: string; fieldErrors?: Record<string, readonly string[]> };

      return { code: body.code, fields: Object.keys(body.fieldErrors ?? {}), status: response.status };
    };

    let flagged = false;

    afterAll(async () => {
      // Off again whatever happened above: every other suite in the run reads
      // this row.
      if (flagged) {
        await SettingsController.setFlag('premium', false, UNAUDITED);
      }
    });

    it('accepts sixty things and refuses the sixty-first, naming the field and not the word', async () => {
      const who = await newcomer('bound-free');
      const refused = await fillAndOverflow(who);

      expect(refusal(refused)).toEqual({ code: 'INVALID_INPUT', fields: ['label'], status: 422 });
      // The label is the person's and does not belong in an error: not in the
      // message, not in a field error, not anywhere in the bytes sent back.
      expect(refused.text).not.toContain('morcilla');
      expect(refused.text).not.toContain('zzxqv');

      // A refusal that had made room for itself would read as a success.
      expect(pantryOf(await read(who).expect(200)).items).toHaveLength(MAX_PANTRY_ITEMS);
    }, 300_000);

    it('refuses the sixty-first on a premium account too — the bound is not a tier', async () => {
      const who = await newcomer('bound-premium');

      // Both halves, as `fixed-meals.e2e-spec.ts` does it: the account's tier
      // and the switch that makes any tier but free exist at all. Without them
      // this test is the free one twice over.
      await UserController.setTier(who.id, 'premium', UNAUDITED);
      await SettingsController.setFlag('premium', true, UNAUDITED);
      flagged = true;

      // Read back before anything is asserted about the bound: a `setTier` that
      // did nothing would make this test the free one twice over and it would
      // still be green. Read from the account's own row and **not** from
      // `GET /billing`: with no Stripe configured — which is every environment
      // but production — that route answers its `available: false` arm, which
      // carries the two tiers' allowances and no `tier` at all, so the guard
      // read `undefined` and failed a test about the cupboard.
      expect((await UserController.getUser({ id: who.id })).tier).toBe('premium');

      expect(refusal(await fillAndOverflow(who))).toEqual({ code: 'INVALID_INPUT', fields: ['label'], status: 422 });
      expect(pantryOf(await read(who).expect(200)).items).toHaveLength(MAX_PANTRY_ITEMS);
    }, 300_000);
  });

  describe('a draft nothing outlives (PRD 022, criterion 6)', () => {
    it('empties the cupboard, and answers the same for one that was already empty', async () => {
      const who = await newcomer('cleared');

      await add(who, { grams: 200, label: 'merluza', unit: 'g' }).then(response => expect(response.status).toBe(201));
      await add(who, { label: UNKNOWN }).then(response => expect(response.status).toBe(201));
      expect(pantryOf(await read(who).expect(200)).items).toHaveLength(2);

      const cleared = await empty(who);

      expect(cleared.status).toBe(200);
      expect(pantryOf(cleared)).toEqual({ items: [], maxItems: MAX_PANTRY_ITEMS });

      // Idempotent, and that is the decision: the state the caller asked for is
      // the state they get either way, which is also what the generation calls
      // once it has spent the draft (phase 2).
      const again = await empty(who);

      expect(again.status).toBe(200);
      expect(again.text).toEqual(cleared.text);
      expect(pantryOf(await read(who).expect(200))).toEqual({ items: [], maxItems: MAX_PANTRY_ITEMS });
    }, 60_000);

    it('takes one thing out and answers the cupboard without it', async () => {
      const who = await newcomer('removed');

      const kept = await add(who, { grams: 200, label: 'merluza', unit: 'g' });
      const going = await add(who, { label: UNKNOWN });

      expect(going.status).toBe(201);

      const keptId = pantryOf(kept).items[0]?.id as string;
      const goingId = pantryOf(going).items.find(item => item.slug === null)?.id as string;
      const removed = await drop(who, goingId);

      expect(removed.status).toBe(200);
      expect(pantryOf(removed).items.map(item => item.id)).toEqual([keptId]);

      // Gone for good, and gone only once: the same id again is the 404 an id
      // nobody owns gets.
      expect((await drop(who, goingId)).status).toBe(404);
      expect(pantryOf(await read(who).expect(200)).items.map(item => item.id)).toEqual([keptId]);
    }, 60_000);
  });

  describe('what the picker may offer (022 phase 3a, step 1)', () => {
    it('answers no word, an empty word and a blank one with the one same top of the catalogue', async () => {
      const who = await newcomer('catalogue-top');
      const absent = await offered(who, {}).expect(200);
      const nothing = await offered(who, { q: '' }).expect(200);
      const blank = await offered(who, { q: '   ' }).expect(200);

      expect(foods(absent)).toHaveLength(PANTRY_CATALOGUE_PAGE);
      // Byte for byte and not merely the same length: absent, `''` and `'   '`
      // are the one ask a picker makes before anybody has typed, and answering
      // them differently would make a first render depend on whether the screen
      // sent the field.
      expect(nothing.text).toEqual(absent.text);
      expect(blank.text).toEqual(absent.text);

      // Three fields and no more: no id and no amount, because the body of
      // `POST /pantry` takes neither and what an entry *is* is never decided by
      // something a request carried.
      for (const food of foods(absent)) {
        expect(Object.keys(food).sort()).toEqual(['cookedWith', 'name', 'slug']);
      }
    }, 120_000);

    it('resolves every name it offered, onto the very food it offered it as', async () => {
      const who = await newcomer('catalogue-round-trip');
      const rows = foods(await offered(who, {}).expect(200));

      // The whole answer fits in one cupboard, which is what lets the round
      // trip be asked of every row of it rather than of a sample.
      expect(rows).toHaveLength(PANTRY_CATALOGUE_PAGE);
      expect(PANTRY_CATALOGUE_PAGE).toBeLessThanOrEqual(MAX_PANTRY_ITEMS);

      for (const food of rows) {
        const added = await add(who, { label: food.name });

        expect({ name: food.name, status: added.status }).toEqual({ name: food.name, status: 201 });
      }

      const cupboard = pantryOf(await read(who).expect(200));

      // Fifty names in, fifty entries out: two offered rows whose names
      // normalise the same would have written one over the other, which is a
      // picker that silently loses a food.
      expect(cupboard.items).toHaveLength(rows.length);
      // **And each one landed on the food it was offered as.** `slug: null`
      // anywhere here is the single failure this route exists to prevent — a
      // picker offering a word its own resolver then misses, which is an entry
      // covering no shopping row and nothing on the screen to say why.
      expect(cupboard.items.map(item => ({ label: item.label, slug: item.slug })).sort(byLabel)).toEqual(
        rows.map(food => ({ label: food.name, slug: food.slug })).sort(byLabel)
      );
    }, 300_000);

    it('resolves every English name it offered, onto the very food it offered it as', async () => {
      const who = await newcomer('catalogue-en-round-trip');
      // `Accept-Language` is the first arm of `listCatalogue`'s cascade — header,
      // then the profile, then `es-ES`, then the slug — and this account has no
      // profile, so a Spanish name coming back here would mean the header was
      // not read at all.
      const rows = foods(await offered(who, {}, 'en-GB').expect(200));
      const spanish = await namesOf(rows.map(food => food.slug));

      expect(rows).toHaveLength(PANTRY_CATALOGUE_PAGE);
      // The arm this run landed on, stated rather than assumed: every food of
      // this catalogue has an `en-GB` name, and it is a different word from the
      // Spanish one — so the case below is not the Spanish round trip again
      // under another header.
      expect(rows.filter(food => food.name !== spanish.get(food.slug)).length).toBeGreaterThan(rows.length / 2);

      for (const food of rows) {
        // **Unmodified**: no trim, no case change, no normalisation of ours.
        // What a screen sends back is the string the API gave it, and the
        // question is whether the API can re-answer its own answer.
        const added = await add(who, { label: food.name });

        expect({ name: food.name, status: added.status }).toEqual({ name: food.name, status: 201 });
      }

      const cupboard = pantryOf(await read(who).expect(200));

      expect(cupboard.items).toHaveLength(rows.length);
      // Each English word landed on the food it was offered as — which is the
      // same slug the Spanish name for that food resolves to, pinned by the
      // case above. `toMatchIndex` holds every locale's names, and this is what
      // says the picker's index and the resolver's agree in both languages
      // rather than merely both answering something.
      expect(cupboard.items.map(item => ({ label: item.label, slug: item.slug })).sort(byLabel)).toEqual(
        rows.map(food => ({ label: food.name, slug: food.slug })).sort(byLabel)
      );
    }, 300_000);

    it('refuses a word longer than a label may be, and does not echo it back', async () => {
      const who = await newcomer('catalogue-long');
      const tooLong = 'zzxqv'.repeat(Math.ceil((MAX_PANTRY_LABEL_LENGTH + 1) / 5));
      const refused = await offered(who, { q: tooLong });

      expect(tooLong.length).toBeGreaterThan(MAX_PANTRY_LABEL_LENGTH);
      expect(refused.status).toBe(422);
      expect((refused.body as { code: string }).code).toBe('INVALID_INPUT');
      // A picker is typed into once per keystroke, so the word somebody tried
      // belongs in a response body as little as in a log (criterion 7): not in
      // the message, not in a field error, nowhere in the bytes.
      expect(refused.text).not.toContain('zzxqv');
    }, 60_000);

    it('has no GET with the word in the query string, and that is the decision rather than an omission', async () => {
      const who = await newcomer('catalogue-get');
      const got = await request(httpServer(app)).get(`/${PREFIX}/pantry/catalogue`).query({ q: 'arroz' }).set('Cookie', who.cookie);

      // 404 because no such route exists. *Search Params* is a recorded field
      // of every Vercel runtime log entry, a store we cannot redact, and
      // `/privacidad` promises *«los registros del servidor y de errores no
      // guardan lo que escribes»* (`legal`'s P1-1 of 2026-11-03; `0100` chose a
      // POST for `/fixed-meals/not-offered` in those words). This case is what
      // stops the route being turned back into a GET for tidiness.
      expect(got.status).toBe(404);
      // Nest's own route miss, and nothing of ours: no handler read the word.
      // Its message does echo the whole URL back, the query string included —
      // which is one more reason the route is a POST and not a GET, since a
      // real `GET /pantry/catalogue?q=…` would put the word in the platform's
      // log *and* in the body of every refusal.
      expect((got.body as { code: string }).code).toBe('NOT_FOUND');

      // The POST answers the same word, so the 404 above is this method's
      // absence and not the route's.
      expect((await offered(who, { q: 'arroz' }).expect(200)).status).toBe(200);
    }, 60_000);

    it('offers the food that carries a declared allergen, byte for byte as it does to an account that declared nothing', async () => {
      const [carrier] = await sql()<Food>`
        select ingredient_names.name, ingredients.slug
        from ingredients
        join ingredient_names on ingredient_names.ingredient_id = ingredients.id and ingredient_names.locale = 'es-ES'
        join ingredient_allergens on ingredient_allergens.ingredient_id = ingredients.id
        join allergens on allergens.id = ingredient_allergens.allergen_id and allergens.key = 'gluten'
        order by ingredients.slug
        limit 1`;

      if (!carrier) {
        throw new Error('No catalogue food carries gluten in this database, so there is nothing a picker could have narrowed away');
      }

      const allergens: Response = await request(httpServer(app)).get(`/${PREFIX}/safety/allergens`).expect(200);
      const glutenId = (allergens.body as readonly { id: string; key: string }[]).find(allergen => allergen.key === 'gluten')?.id ?? '';
      const declared = await newcomer('catalogue-allergic');
      const nobody = await newcomer('catalogue-anybody');

      expect(glutenId).not.toBe('');
      await giveProfileConsent(app, declared);
      await request(httpServer(app))
        .put(`/${PREFIX}/safety/restrictions`)
        .set('Cookie', declared.cookie)
        .send({ allergies: [{ allergenId: glutenId, crossContaminationSensitive: true, severity: 'severe' }], customAllergens: [], intolerances: [] })
        .expect(204);

      // Read back before anything is asserted about the answer: a declaration
      // that did not land would make this case the unrestricted one twice over
      // and it would still be green.
      const restrictions: Response = await request(httpServer(app)).get(`/${PREFIX}/safety/restrictions`).set('Cookie', declared.cookie).expect(200);

      expect((restrictions.body as { allergies: readonly unknown[] }).allergies).toHaveLength(1);

      const theirs = await offered(declared, { q: carrier.name }).expect(200);
      const everybodys = await offered(nobody, { q: carrier.name }).expect(200);

      // **The food is still offered**, and the whole answer is the same bytes.
      // A picker that quietly hid somebody's allergens would be performing the
      // inference criterion 8 forbids — in the catalogue instead of the
      // scheduler — and would tell them the catalogue is missing a food we
      // have. A cupboard is what somebody *has*, which is not what they may eat.
      expect(foods(theirs).map(food => food.slug)).toContain(carrier.slug);
      expect(theirs.text).toEqual(everybodys.text);
    }, 120_000);
  });

  describe('whether the library does anything with what is in the cupboard (022 phase 3a, step 2)', () => {
    /** A food no recipe lists, no plate reaches through the mapping, and nothing is served beside. */
    let uncooked: Food;
    /** A dry food this library plates **only** under its cooked name, so `cookedWith` can be true of it through the mapping alone. */
    let mapped: Food;
    /** A food this library serves beside a plate and no recipe lists. */
    let side: Food;

    beforeAll(async () => {
      const plated = await platedSlugs();
      // Everything `cookedWith` may answer yes about without either the mapping
      // or the sides: a plated slug, and the dry food a plated cooked one is
      // bought as.
      const reachable = new Set<string>(plated);

      for (const slug of plated) {
        const dry = toDry(slug, 0)?.drySlug;

        if (dry !== undefined && dry !== null) {
          reachable.add(dry);
        }
      }

      const mappedOnly = [...plated]
        .map(slug => toDry(slug, 0)?.drySlug)
        .filter((dry): dry is string => dry !== undefined && dry !== null && !plated.has(dry) && !SERVED_BESIDE.has(dry))
        .sort();
      const sideOnly = [...SERVED_BESIDE].filter(slug => !reachable.has(slug)).sort();
      const candidates = await sql()<Food>`
        select ingredient_names.name, ingredients.slug
        from ingredients
        join ingredient_names on ingredient_names.ingredient_id = ingredients.id and ingredient_names.locale = 'es-ES'
        where not exists (select 1 from recipe_ingredients where recipe_ingredients.ingredient_id = ingredients.id)
        order by ingredients.slug`;
      const nothing = candidates.find(food => !reachable.has(food.slug) && !SERVED_BESIDE.has(food.slug));
      const names = await namesOf([...mappedOnly.slice(0, 1), ...sideOnly]);

      const named = (slugs: readonly string[]): Food | undefined => {
        const slug = slugs.find(candidate => names.has(candidate));

        return slug === undefined ? undefined : { name: names.get(slug) as string, slug };
      };

      const dry = named(mappedOnly);
      const beside = named(sideOnly);

      // Each one stops the suite with what the library actually held instead of
      // leaving a case true of nothing. The figures differ by machine — ~1,100
      // dishes here against CI's ~90 — which is why none of the three is a
      // constant.
      if (!nothing) {
        throw new Error(
          `Every named food of this catalogue is cooked with, served beside a plate or bought as one: ${candidates.length} uncooked rows`
        );
      }

      if (!dry) {
        throw new Error(
          `No dry food of this library is plated only under its cooked name and not also served beside a plate, so nothing here can tell the dual mapping from the raw rule. The mapped-only slugs were: ${mappedOnly.join(', ') || 'none'}`
        );
      }

      if (!beside) {
        throw new Error(
          `Every accompaniment of this library is also listed by a recipe, so the sides cannot be told from the plate counts: ${sideOnly.length} candidates`
        );
      }

      mapped = dry;
      side = beside;
      uncooked = nothing;
    }, 120_000);

    it('says the library cooks nothing with a food it cooks nothing with, and keeps it in the cupboard all the same', async () => {
      const who = await newcomer('uncooked');
      const added = await add(who, { label: uncooked.name });

      expect({ slug: pantryOf(added).items[0]?.slug, status: added.status }).toEqual({ slug: uncooked.slug, status: 201 });
      // **A different fact from `slug: null`**, which PRD 12 counts apart: the
      // catalogue has this food and no dish cooks it. One is an ingredient to
      // add, the other a dish to write.
      expect(pantryOf(added).items).toEqual([expect.objectContaining({ cookedWith: false, label: uncooked.name, slug: uncooked.slug })]);
      // **And it stays.** Nothing here is a restriction: the entry is not
      // removed, not refused and not shown as refused (criterion 8).
      expect(pantryOf(await read(who).expect(200)).items.map(item => ({ cookedWith: item.cookedWith, slug: item.slug }))).toEqual([
        { cookedWith: false, slug: uncooked.slug }
      ]);
    }, 60_000);

    it('says the library cooks with a dry food whose plates only ever carry its cooked name', async () => {
      const who = await newcomer('mapped');
      const added = await add(who, { label: mapped.name });

      // The precondition `beforeAll` chose it for, stated where it is read: no
      // recipe lists this food and nothing is served beside it, so `true` here
      // can only have come through what a plate's cooked food is **bought** as
      // (`0078`, and `platesAsBought`). Reverting that mapping makes this entry
      // read `cookedWith: false`.
      expect({ slug: pantryOf(added).items[0]?.slug, status: added.status }).toEqual({ slug: mapped.slug, status: 201 });
      expect(pantryOf(added).items).toEqual([expect.objectContaining({ cookedWith: true, slug: mapped.slug })]);
    }, 60_000);

    it('says the library cooks with a cupboard of «arroz» — though not only through the mapping, which is why it is not the case above', async () => {
      const who = await newcomer('coarse-cooked-with');
      const added = await add(who, { label: 'arroz' });

      expect(pantryOf(added).items).toEqual([expect.objectContaining({ cookedWith: true, slug: 'arroz-largo-crudo' })]);
      // The plan names this as *the* example of the mapping, and it is the word
      // somebody really types — but `arroz-largo-crudo` is also an ingredient
      // of the `arroz-blanco` and `arroz-rojo` accompaniments, so
      // `domain/Pantry`'s `SERVED_BESIDE` answers `true` for it whatever the
      // plates say. Stated here rather than quietly relied on: this case says
      // the coarse word is answered, and the case above is the one that pins
      // the dual mapping, on a food chosen for not being a side.
      expect(SERVED_BESIDE.has('arroz-largo-crudo')).toBe(true);
    }, 60_000);

    it('says the library does something with a food it only ever serves beside a plate', async () => {
      const who = await newcomer('side');
      const added = await add(who, { label: side.name });

      // Bread, oil, a yoghurt, a melon: served every week by `ACCOMPANIMENTS`
      // and listed by no recipe. Told *«todavía no cocinamos nada con esto»*
      // about one of these, somebody would be reading a false sentence about
      // the food they are likeliest to have.
      expect({ slug: pantryOf(added).items[0]?.slug, status: added.status }).toEqual({ slug: side.slug, status: 201 });
      expect(pantryOf(added).items).toEqual([expect.objectContaining({ cookedWith: true, slug: side.slug })]);
    }, 60_000);
  });
});
