import { InputParseError } from 'core/entities/Error';
import { kitchenOf, MAX_PREFERRED_APPLIANCES } from 'core/entities/Kitchen';
import { KitchenRepository } from '#repositories/Kitchen';

import type { Appliance, Kitchen, KitchenStance } from 'core/entities/Kitchen';

/**
 * A person's kitchen as a screen reads it: every appliance of the catalogue
 * with a stance, whether they have ever said anything, and the bound on
 * preferences so the screen can say it **before** it is hit rather than
 * discovering it in a refusal.
 */
export interface KitchenView {
  readonly appliances: Kitchen;
  /**
   * False for somebody who has never opened the screen — which is most
   * accounts, by design. It is what lets the screen say that silence means a
   * normal kitchen instead of showing three choices already made (`0102`).
   */
  readonly described: boolean;
  readonly maxPreferred: number;
}

// --- Presenters ---------------------------------------------------------------

function presentKitchen(stances: readonly KitchenStance[]): KitchenView {
  return { appliances: kitchenOf(stances), described: stances.length > 0, maxPreferred: MAX_PREFERRED_APPLIANCES };
}

// --- Controller ---------------------------------------------------------------

export const KitchenController = {
  /**
   * Puts an appliance back to whatever the default kitchen says about it, by
   * deleting what this person said about it.
   *
   * **Idempotent, and that is a decision**: clearing an appliance nobody ever
   * spoke about answers the same as clearing one they did, because the state
   * the caller asked for is the state they get either way. It is the one place
   * this controller does not answer a missing row with a `NotFoundError` the
   * way `FixedMealController.remove` does, and the difference is what is being
   * named: a rule's id is somebody's and a 404 is what keeps an id from
   * confirming that another account's rule exists (`0019`), while `oven` is a
   * catalogue key that every account shares and no answer about it reveals
   * anything. A screen whose "back to normal" tap could 404 would be worse for
   * no gain.
   */
  async clearStance(userId: string, appliance: Appliance): Promise<KitchenView> {
    await KitchenRepository.remove(userId, appliance);

    return presentKitchen(await KitchenRepository.findByUser(userId));
  },

  /** What this person said about their kitchen, folded onto the default — one read tells a screen everything. */
  async read(userId: string): Promise<KitchenView> {
    return presentKitchen(await KitchenRepository.findByUser(userId));
  },

  /**
   * Says what this person's kitchen has, does not have, or would rather use for
   * one appliance.
   *
   * **The bound on `prefers` is checked here and nowhere else.** At most three
   * appliances may be preferred — the same on both tiers, a product bound and
   * not a price (`marketing`, 2026-10-15) — and the check happens inside the
   * repository's lock, against rows read in the same transaction that writes,
   * because "count the preferences, then write one" is the read-then-compare
   * that lets two requests both pass a limit of three (`AGENTS.md` §
   * repositories; the same race a security scan found in `EventController.add`
   * on 2026-09-22).
   *
   * The appliance being written is left out of the count by the repository, so
   * re-stating a preference somebody already has is never the fourth one.
   *
   * `InputParseError` and not a quota error: nothing here is spent or counted
   * per month, there is no tier to upgrade to and no time at which it frees up
   * — the request simply says one thing too many, which is 422 with the field
   * named (`AllExceptions.filter`).
   */
  async setStance(userId: string, stance: KitchenStance): Promise<KitchenView> {
    const stances = await KitchenRepository.setStance(userId, stance, others => {
      if (stance.stance !== 'prefers') {
        return;
      }

      if (others.filter(other => other.stance === 'prefers').length >= MAX_PREFERRED_APPLIANCES) {
        throw new InputParseError(`At most ${MAX_PREFERRED_APPLIANCES} appliances may be preferred`, {
          appliance: [`At most ${MAX_PREFERRED_APPLIANCES} appliances may be preferred`]
        });
      }
    });

    return presentKitchen(stances);
  }
};
