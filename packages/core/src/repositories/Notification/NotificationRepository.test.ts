import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NotificationRepository } from './NotificationRepository';

/** Every statement sent, as Postgres would receive it, from a postgres.js stand-in that answers nothing. */
const sent = vi.hoisted(() => [] as { params: unknown[]; sql: string }[]);

vi.mock('database', async () => {
  const { drizzle } = await import('drizzle-orm/postgres-js');

  const answer = (sql: string, params: unknown[]) => {
    sent.push({ params, sql });

    return Object.assign(Promise.resolve([]), { values: () => Promise.resolve([]) });
  };

  const db = drizzle({ casing: 'snake_case', client: { options: { parsers: {}, serializers: {} }, unsafe: answer } as never });

  return { database: () => db };
});

beforeEach(() => {
  sent.length = 0;
});

describe('NotificationRepository.recordSent', () => {
  it('writes one row per channel that carried the notice, in one statement (`0071`)', async () => {
    await NotificationRepository.recordSent('usr-1', { body: 'Dos minutos', channels: ['email', 'push'], title: 'Tu quincena', type: 'checkin_due' });

    expect(sent).toHaveLength(1);

    const [insert] = sent;

    expect(insert?.sql).toMatch(/^insert into "notifications" .* values \(.*\), \(.*\)$/);
    expect(insert?.params.filter(param => param === 'email')).toHaveLength(1);
    expect(insert?.params.filter(param => param === 'push')).toHaveLength(1);
    expect(insert?.params.filter(param => param === 'usr-1')).toHaveLength(2);
  });

  it('writes a channel once however often it is named', async () => {
    await NotificationRepository.recordSent('usr-1', { body: 'b', channels: ['push', 'push'], title: 't', type: 'checkin_submitted' });

    expect(sent[0]?.sql).not.toMatch(/\), \(/);
  });
});
