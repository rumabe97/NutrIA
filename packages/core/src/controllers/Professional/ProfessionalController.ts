import { ProfessionalRepository } from '#repositories/Professional';
import { SettingsRepository } from '#repositories/Settings';
import { UserRepository } from '#repositories/User';
import { FLAGS } from 'core/domain/Flag';
import { NotFoundError } from 'core/entities/Error';

import type { ProfessionalListRow } from '#repositories/Professional';
import type { GrantProfessional, Professional } from 'core/entities/Professional';

// --- Presenters ---------------------------------------------------------------

/**
 * The professional's own grant, as they may read it: the number, the date, and
 * what their practice includes. Never another account's data — `grantedBy` is
 * the owner's id and stays in the row.
 */
export interface ProfessionalView {
  collegiateNumber: string;
  grantedAt: string;
  includedClients: number;
  practiceOpen: boolean;
}

/**
 * How many links a professional holds, per status. A count and never a name:
 * the owner's list may say *how many* clients, and nothing about *who* (`0028`).
 */
export interface LinkCounts {
  active: number;
  ended: number;
  paused: number;
}

/** One professional on the owner's list: the account, its grant, and its links counted. */
export interface ProfessionalAccountView {
  collegiateNumber: string;
  email: string;
  grantedAt: string;
  links: LinkCounts;
  userId: string;
}

function present(row: Professional): ProfessionalView {
  return {
    collegiateNumber: row.collegiateNumber,
    grantedAt: row.grantedAt.toISOString(),
    includedClients: row.includedClients,
    practiceOpen: row.practiceOpen
  };
}

/**
 * Zero of each, because there is no `care_links` table yet: Phase 2 of project
 * 004 creates it and replaces this with a count per status from the repository.
 * The shape is settled now so the owner's screen is built against it once.
 */
function noLinksYet(): LinkCounts {
  return { active: 0, ended: 0, paused: 0 };
}

function presentAccount(row: ProfessionalListRow): ProfessionalAccountView {
  return {
    collegiateNumber: row.collegiateNumber,
    email: row.email,
    grantedAt: row.grantedAt.toISOString(),
    links: noLinksYet(),
    userId: row.userId
  };
}

// --- Controller ---------------------------------------------------------------

/**
 * Who is a professional (`0059`): an account the owner granted, with a
 * collegiate number, and nothing else. Every method here takes the account's
 * id from the caller the way every controller does — the admin routes pass the
 * account the owner named, the guard passes the session's own.
 */
export const ProfessionalController = {
  /**
   * The professional's own grant, or null when the account is not one.
   *
   * Null rather than a throw because the caller's question is "am I one?", and
   * a route that must refuse does so itself, as a 404 like every other denial.
   */
  async find(userId: string): Promise<ProfessionalView | null> {
    const row = await ProfessionalRepository.find(userId);

    return row ? present(row) : null;
  },

  /**
   * The owner's act. A 404 when the account does not exist, like every other
   * denial: the owner typing an id that is not there learns the same thing a
   * stranger would.
   *
   * Also a 404 while the address is unconfirmed. The owner grants because an
   * address belongs to a dietitian, and anybody can register that address
   * without owning it; only a confirmed one says the person holds the inbox.
   */
  async grant(userId: string, input: GrantProfessional, grantedBy: string): Promise<ProfessionalAccountView> {
    const account = await UserRepository.findById(userId);

    if (!account?.emailVerified) {
      throw new NotFoundError(`User "${userId}" not found`);
    }

    const row = await ProfessionalRepository.grant(userId, input.collegiateNumber, grantedBy);

    return presentAccount({ ...row, email: account.email });
  },

  /**
   * Whether this account may use the workspace *today*: the `professional`
   * switch is on **and** the owner granted it.
   *
   * The switch first. Off, nobody is a professional — the workspace does not
   * exist, whatever the table says — so a granted account is an ordinary one
   * until the owner's legal review throws it. Read on every request the guard
   * sees, never cached: revoking must close access on the very next one.
   */
  async hasAccess(userId: string): Promise<boolean> {
    const open = await SettingsRepository.isEnabled(FLAGS.professional.key, FLAGS.professional.fallback);

    if (!open) {
      return false;
    }

    return (await ProfessionalRepository.find(userId)) !== null;
  },

  /** Every professional for the owner's screen — accounts and counts, never a client. */
  async list(): Promise<readonly ProfessionalAccountView[]> {
    const rows = await ProfessionalRepository.list();

    return rows.map(presentAccount);
  },

  /** Takes the grant back. A 404 when the account was not a professional. */
  async revoke(userId: string): Promise<void> {
    if (!(await ProfessionalRepository.revoke(userId))) {
      throw new NotFoundError(`User "${userId}" is not a professional`);
    }
  }
};
