import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';

import { HEALTH_CONSENT_VERSION } from 'core/entities/Health';

import { HealthController } from './HealthController';

import type { RuleEnding } from '#repositories/Care';
import type { SetHealthData } from 'core/entities/Health';
import type { StoredHealthData } from '#repositories/Health';
import type * as HealthRepositoryModule from '../../repositories/Health/HealthRepository';

const TX = { name: 'the declaration’s transaction' };
const replaceAll = vi.fn<(userId: string, input: SetHealthData, within?: (tx: unknown) => Promise<unknown>) => Promise<unknown>>();
const endOnDeclaration = vi.fn<(clientId: string, now: Date, tx: unknown) => Promise<RuleEnding | null>>();
const findAll = vi.fn<(userId: string) => Promise<StoredHealthData>>();

vi.mock('#repositories/Health', async () => ({
  HealthRepository: {
    findAll: (userId: string) => findAll(userId),
    // The repository runs `within` inside its own transaction, after the section is written.
    replaceAll: async (userId: string, input: SetHealthData, within?: (tx: unknown) => Promise<unknown>) => {
      await replaceAll(userId, input, within);

      return within ? within(TX) : undefined;
    }
  },
  onRecord: (await vi.importActual<typeof HealthRepositoryModule>('../../repositories/Health/HealthRepository')).onRecord
}));
vi.mock('#repositories/Care', () => ({
  CareRepository: { endOnDeclaration: (clientId: string, now: Date, tx: unknown) => endOnDeclaration(clientId, now, tx) }
}));
vi.mock('#repositories/Safety', () => ({
  SafetyRepository: { findAllergies: async () => [], findIntolerances: async () => [], listAllergens: async () => [] }
}));

const NOW = new Date('2026-11-19T10:00:00.000Z');
const INPUT: SetHealthData = {
  conditions: [{ conditionKey: 'pregnancy', label: 'Embarazo' }],
  consentVersion: HEALTH_CONSENT_VERSION,
  medications: [],
  supplements: []
};

beforeEach(() => {
  replaceAll.mockReset();
  endOnDeclaration.mockReset();
  findAll.mockReset();
  findAll.mockResolvedValue({ conditions: [], consentVersion: HEALTH_CONSENT_VERSION, medications: [], supplements: [] });
});

/*
 * Project 025 phase 5 (`0111` § 8, PRD 025 criterion 22): a declaration ends a
 * link to an un-badged practitioner in its own transaction, and says so to the
 * person who saved it — by the practitioner's name and nothing else.
 */
describe('HealthController.replace — the illness rule', () => {
  it('hands the rule to the repository, to run in the declaration’s own transaction, for the session’s account', async () => {
    endOnDeclaration.mockResolvedValue(null);

    await expect(HealthController.replace('usr-client', INPUT, NOW)).resolves.toMatchObject({ linkEnded: null });
    expect(replaceAll).toHaveBeenCalledExactlyOnceWith('usr-client', INPUT, expect.any(Function));
    expect(endOnDeclaration).toHaveBeenCalledExactlyOnceWith('usr-client', NOW, TX);
  });

  it('answers the ended link by the practitioner’s name alone', async () => {
    endOnDeclaration.mockResolvedValue({ clientId: 'usr-client', linkId: 'link-1', professionalName: 'Ana' });

    const view = await HealthController.replace('usr-client', INPUT, NOW);

    expect(view.linkEnded).toEqual({ professionalName: 'Ana' });
    expect(JSON.stringify(view)).not.toContain('link-1');
  });

  /* Invariant review of phase 6, round two: the rule ends only an un-badged practitioner's link, so the name is judged without the badge. */
  it('answers no name when the practitioner’s name carries a title only the badge allows', async () => {
    endOnDeclaration.mockResolvedValue({ clientId: 'usr-client', linkId: 'link-1', professionalName: 'Ana, nutricionista' });

    await expect(HealthController.replace('usr-client', INPUT, NOW)).resolves.toMatchObject({ linkEnded: { professionalName: null } });
  });
});

describe('the illness rule’s version of the consent (legal F1)', () => {
  it('is 1.2.0: the note names the rule, and a 1.1.0 consent is asked again', async () => {
    expect(HEALTH_CONSENT_VERSION).toBe('1.2.0');

    findAll.mockResolvedValue({ conditions: [], consentVersion: '1.1.0', medications: [], supplements: [] });

    await expect(HealthController.get('usr-client')).resolves.toMatchObject({ consentIsCurrent: false });
  });
});

describe('onRecord — the one definition of "on record"', () => {
  it('is any condition row or any medication, for the account named — never a supplement', async () => {
    const { onRecord } = await vi.importActual<typeof HealthRepositoryModule>('../../repositories/Health/HealthRepository');
    const { params, sql } = new PgDialect({ casing: 'snake_case' }).sqlToQuery(onRecord('usr-client'));

    expect(sql).toBe(
      '(exists (select 1 from "health_conditions" where "health_conditions"."user_id" = $1) or exists (select 1 from "medications" where "medications"."user_id" = $2))'
    );
    expect(params).toEqual(['usr-client', 'usr-client']);
  });
});
