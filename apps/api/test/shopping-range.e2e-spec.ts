import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';

import { rangeQuantity } from 'core/domain/ShoppingList';
import { database } from 'database';

import { completeOnboarding, createApp, deleteAccounts, generateAndWait, httpServer, POOL, PREFIX, register, ScriptedAiClient } from './harness.js';

import type { Account } from './harness.js';
import type { MeasurementUnit } from 'core/entities/Plan';
import type { PlanView, ShoppingListItemView, ShoppingListView } from 'core/controllers/Plan';
import type { INestApplication } from '@nestjs/common';
import type { Response } from 'supertest';

/**
 * The list is read by range and bought by amount (`0091`, project 020 phase 5):
 * one row per ingredient, the breakdown of what each day owes it travels with
 * the list, and what is bought is a gram amount rather than a boolean. Today's
 * other suites only ever send a tick (`fortnight.e2e-spec.ts`,
 * `care-review.e2e-spec.ts`) — this is the amount's own HTTP cover.
 *
 * The owner's case (PRD 4): a row whose week-1 share is some of its fortnight
 * total. Marked in the week, the fortnight reads the remainder; unmarked in
 * the week, the fortnight is whole again; marked in the fortnight, the week
 * reads done. A swap then carries the amount across, capped at the new need
 * (PRD 7).
 *
 * The rest proves what the amount's write must never do: answer a stranger
 * (PRD 10), forget the cap, disagree with the `checked` it derives, or round
 * into the one state `0091` forbids — a row both fully bought and marked not
 * done.
 *
 * The split row is found on the real generated plan rather than assumed: the
 * scripted model's dish choice is not fixed, so a literal grams figure would
 * be flaky. If no row splits between the two weeks, this suite says so rather
 * than forcing one.
 *
 * Requires a real database and a seeded catalogue, on the local Postgres —
 * see ./README.md.
 */
type Row = <R>(strings: TemplateStringsArray, ...values: readonly (number | string)[]) => Promise<R[]>;

/** Parameterised reads and the one write no route makes, as in `care-review.e2e-spec.ts`. */
function tables(): Row {
  return (database() as unknown as { readonly $client: Row }).$client;
}

/**
 * `rangeQuantity` against the view's own fields. The view widens `displayUnit`
 * to `string` for the wire; it always holds one of `core/entities/Plan`'s
 * `MeasurementUnit`, which is what the domain function it feeds declares.
 */
function rangeOf(item: ShoppingListItemView, days: Iterable<string>) {
  return rangeQuantity(
    {
      displayQuantity: item.displayQuantity,
      displayUnit: item.displayUnit as MeasurementUnit,
      dryRounded: item.dryRounded,
      gramsPerUnit: item.gramsPerUnit,
      perDay: item.perDay,
      totalGrams: item.totalGrams
    },
    days
  );
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

describe('the shopping list, read by range and bought by amount (0091)', () => {
  let app: INestApplication;
  let account: Account;
  let stranger: Account;
  let plan: PlanView;
  /** Every day of the plan, oldest first. */
  let allDates: readonly string[];
  /** The first seven of `allDates` — "week 1" for the owner's case. */
  let week1Dates: readonly string[];
  /** The row this suite proves the owner's case on: a partial split between week 1 and the fortnight. */
  let splitRow: ShoppingListItemView;
  /** What week 1 alone needs of `splitRow`. */
  let week1Total: number;
  /** Every account this suite registered, so `afterAll` can delete each one. */
  const made: string[] = [];
  /** Row names already claimed by one case, so two cases never fight over the same row. */
  const claimed = new Set<string>();
  const stamp = Date.now();

  async function shoppingList(who: Account): Promise<ShoppingListView> {
    const response: Response = await request(httpServer(app)).get(`/${PREFIX}/shopping-lists/active`).set('Cookie', who.cookie).expect(200);

    return response.body as ShoppingListView;
  }

  function setBought(who: Account, itemId: string, body: { boughtGrams?: number; checked?: boolean }) {
    return request(httpServer(app)).patch(`/${PREFIX}/shopping-lists/items/${itemId}`).set('Cookie', who.cookie).send(body);
  }

  /** An untouched row — nothing bought on it yet — that no earlier case has claimed. */
  async function freshRow(): Promise<ShoppingListItemView> {
    const list = await shoppingList(account);
    const found = list.items.find(row => row.boughtGrams === 0 && !claimed.has(row.name));

    if (!found) {
      throw new Error('No untouched shopping row left unclaimed for this case');
    }

    claimed.add(found.name);

    return found;
  }

  beforeAll(async () => {
    app = await createApp(new ScriptedAiClient(POOL));

    account = await register(app, `shopping-range-${stamp}@e2e.invalid`);
    made.push(account.cookie);
    // Only ever a stranger to account's own list — no onboarding of its own needed for that.
    stranger = await register(app, `shopping-range-other-${stamp}@e2e.invalid`);
    made.push(stranger.cookie);

    await completeOnboarding(app, account);

    const job = await generateAndWait(app, account);

    expect(job.status).toBe('succeeded');

    const activePlan: Response = await request(httpServer(app)).get(`/${PREFIX}/meal-plans/active`).set('Cookie', account.cookie).expect(200);

    plan = activePlan.body as PlanView;
    allDates = [...plan.days].sort((a, b) => a.dayIndex - b.dayIndex).map(day => day.date);
    week1Dates = allDates.slice(0, 7);

    const list = await shoppingList(account);
    const candidates = list.items
      .map(item => ({ item, share: rangeOf(item, week1Dates).totalGrams }))
      .filter(({ item, share }) => share > 0 && share < item.totalGrams)
      // The most broadly used ingredient of the candidates: safest against the later swap removing it outright.
      .sort((a, b) => b.item.totalGrams - a.item.totalGrams);

    if (candidates.length === 0) {
      throw new Error(
        "No row of this generated plan splits between week 1 and the fortnight — every row's need falls entirely inside or entirely outside week 1 — so the owner's case (PRD 4) has nothing to prove itself on here. The scripted model's dish choice is not fixed; re-running this suite may produce a plan that does."
      );
    }

    splitRow = candidates[0]!.item;
    week1Total = candidates[0]!.share;
    claimed.add(splitRow.name);
  });

  afterAll(async () => {
    await deleteAccounts(app, made);
    await app?.close();
  });

  it(
    "buys the week, reads the fortnight's remainder; unmarks back to the fortnight's own figure; " +
      'marks the fortnight and reads the week as done (PRD 4)',
    async () => {
      // Marking sends max(bought, needed(range)); bought starts at zero, so this is just the week's own share.
      await setBought(account, splitRow.id, { boughtGrams: week1Total }).expect(204);

      let after = (await shoppingList(account)).items.find(row => row.id === splitRow.id);

      expect(after?.boughtGrams).toBe(round2(week1Total));
      // The fortnight needs more than the week bought: not done under the whole plan's own need.
      expect(after?.checked).toBe(false);
      expect(splitRow.totalGrams - (after?.boughtGrams ?? 0)).toBeGreaterThan(0);

      // Unmarking sends max(0, bought - needed(range)) — exactly what was just bought for the week.
      await setBought(account, splitRow.id, { boughtGrams: Math.max(0, week1Total - week1Total) }).expect(204);

      after = (await shoppingList(account)).items.find(row => row.id === splitRow.id);
      expect(after?.boughtGrams).toBe(0);
      // Back to the fortnight's own figure: nothing bought, the whole need still to buy.
      expect(splitRow.totalGrams - (after?.boughtGrams ?? 0)).toBe(splitRow.totalGrams);

      // An unfiltered range equals the stored total (PRD 2) — marking "the fortnight" is marking exactly this.
      expect(rangeOf(splitRow, allDates).totalGrams).toBe(splitRow.totalGrams);

      await setBought(account, splitRow.id, { boughtGrams: splitRow.totalGrams }).expect(204);

      after = (await shoppingList(account)).items.find(row => row.id === splitRow.id);
      expect(after?.boughtGrams).toBe(round2(splitRow.totalGrams));
      expect(after?.checked).toBe(true);
      // Read under the week's own lens: nothing of the week's own share is left to buy.
      expect((after?.boughtGrams ?? 0) >= week1Total).toBe(true);
    }
  );

  it('carries the amount across a swap, capped at the new need (PRD 7)', async () => {
    const before = (await shoppingList(account)).items.find(row => row.id === splitRow.id);

    if (!before) {
      throw new Error('The split row is missing before the swap');
    }

    const target = plan.days[0]?.meals[0]?.id;

    if (!target) {
      throw new Error('The plan has no first meal to swap');
    }

    await request(httpServer(app)).post(`/${PREFIX}/meal-plans/meals/${target}/swap`).set('Cookie', account.cookie).send({}).expect(201);

    // Every rebuild regenerates the row's own id (`replaceGeneratedItems`); its name does not change.
    const after = (await shoppingList(account)).items.find(row => row.name === before.name);

    // It is used across both weeks — that is what made it a usable split in the first place — so one
    // swap of one meal cannot remove it from the list outright.
    expect(after).toBeDefined();
    expect(after?.boughtGrams).toBe(round2(Math.min(before.boughtGrams, after?.totalGrams ?? 0)));
  });

  it("still accepts the old client's tick, deriving the amount it replaced (0091)", async () => {
    const row = await freshRow();

    await setBought(account, row.id, { checked: true }).expect(204);

    const after = (await shoppingList(account)).items.find(item => item.id === row.id);

    expect(after?.boughtGrams).toBe(round2(row.totalGrams));
    expect(after?.checked).toBe(true);
  });

  it("another account's amount is not found, and the row is left exactly as it was (PRD 10)", async () => {
    const row = await freshRow();

    await setBought(stranger, row.id, { boughtGrams: 250 }).expect(404);

    const after = (await shoppingList(account)).items.find(item => item.id === row.id);

    expect(after?.boughtGrams).toBe(0);
    expect(after?.checked).toBe(false);
  });

  it("caps an oversized ask at the row's own need, and derives checked both ways (0091)", async () => {
    const row = await freshRow();

    await setBought(account, row.id, { boughtGrams: 999_999 }).expect(204);

    let after = (await shoppingList(account)).items.find(item => item.id === row.id);

    expect(after?.boughtGrams).toBe(round2(row.totalGrams));
    expect(after?.checked).toBe(true);

    await setBought(account, row.id, { boughtGrams: 0 }).expect(204);

    after = (await shoppingList(account)).items.find(item => item.id === row.id);
    expect(after?.boughtGrams).toBe(0);
    expect(after?.checked).toBe(false);
  });

  it('rounds before comparing, so a 100 g row asked for 99.999 reads back bought and done, never the one state 0091 forbids', async () => {
    // No route creates a row like this one (adding a row is out of 020's scope) — written on the
    // table, as `harness.ts`'s `openPractice` and `markLegacyOnboarding` write what no route does.
    const [list] = await tables()<{ id: string }>`select id from shopping_lists where plan_id = ${plan.id}`;

    if (!list) {
      throw new Error('No shopping list for the active plan');
    }

    const [row] = await tables()<{ id: string }>`
      insert into shopping_list_items (list_id, name, category, total_grams, display_quantity, added_manually)
      values (${list.id}, ${`shopping-range rounding ${stamp}`}, 'other'::ingredient_category, '100.00', '100.00', true)
      returning id`;

    if (!row) {
      throw new Error('Could not write the rounding row');
    }

    await setBought(account, row.id, { boughtGrams: 99.999 }).expect(204);

    const after = (await shoppingList(account)).items.find(item => item.id === row.id);

    expect(after?.boughtGrams).toBe(100);
    expect(after?.checked).toBe(true);
  });
});
