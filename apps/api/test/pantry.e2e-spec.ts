import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';

import { MAX_PANTRY_ITEMS } from 'core/entities/Pantry';
import { SettingsController } from 'core/controllers/Settings';
import { UNAUDITED } from 'core/entities/Audit';
import { UserController } from 'core/controllers/User';

import { createApp, deleteAccounts, httpServer, PREFIX, register, ScriptedAiClient } from './harness.js';

import type { Account } from './harness.js';
import type { INestApplication } from '@nestjs/common';
import type { PantryView } from 'core/controllers/Pantry';
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
 * The model is never called — nothing here generates — so the pool is empty on
 * purpose. Requires a real database and a seeded catalogue — see ./README.md.
 */

/** A word no catalogue could hold, so the entry it makes resolves to nothing. */
const UNKNOWN = 'zzxqv de plutonia';

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
});
