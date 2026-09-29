import { beforeEach, describe, expect, it, vi } from 'vitest';

import { feedbackQuerySchema } from 'core/entities/AdminQuery';

import { NotFoundError } from 'core/entities/Error';

import { FeedbackController } from './FeedbackController';

import type { FeedbackQuery } from 'core/entities/AdminQuery';
import type { FeedbackRow } from '#repositories/Feedback';

const findAll = vi.fn<(query: FeedbackQuery) => Promise<{ rows: readonly FeedbackRow[]; total: number; waiting: number }>>();
const setHandled = vi.fn<(id: string, handled: boolean, record?: (tx: unknown) => Promise<void>) => Promise<boolean>>();
const record = vi.fn<(entry: unknown, tx?: unknown) => Promise<void>>();

vi.mock('#repositories/Feedback', () => ({
  FeedbackRepository: {
    findAll: (query: FeedbackQuery) => findAll(query),
    setHandled: (id: string, handled: boolean, r?: (tx: unknown) => Promise<void>) => setHandled(id, handled, r)
  }
}));
vi.mock('#repositories/Audit', () => ({ AuditRepository: { record: (entry: unknown, tx?: unknown) => record(entry, tx) } }));

const ROW: FeedbackRow = {
  id: 'fb-1',
  createdAt: new Date('2026-09-27T18:30:00.000Z'),
  email: 'ana@example.invalid',
  handledAt: null,
  kind: 'problem',
  message: 'No carga el plan'
};

/* The owner's inbox as a table (`0037`, `0068`). */
describe('FeedbackController.list', () => {
  beforeEach(() => {
    findAll.mockReset();
    findAll.mockResolvedValue({ rows: [ROW], total: 3, waiting: 9 });
  });

  it('asks for every message, newest first, 25 at a time, when nothing is asked', async () => {
    const page = await FeedbackController.list();

    expect(findAll).toHaveBeenCalledWith(expect.objectContaining({ dir: 'desc', offset: 0, size: 25, sort: 'createdAt', state: 'all' }));
    expect(page).toMatchObject({ offset: 0, size: 25, total: 3, waiting: 9 });
  });

  it('passes the search and the state through, and keeps the inbox’s own waiting count', async () => {
    const query = feedbackQuerySchema.parse({ offset: '25', q: 'plan', state: 'seen' });
    const page = await FeedbackController.list(query);

    expect(findAll).toHaveBeenCalledWith(query);
    expect(page).toMatchObject({ offset: 25, total: 3, waiting: 9 });
  });

  it('presents a message as the owner reads it', async () => {
    const { rows } = await FeedbackController.list();

    expect(rows).toEqual([
      {
        id: 'fb-1',
        createdAt: '2026-09-27T18:30:00.000Z',
        email: 'ana@example.invalid',
        handled: false,
        kind: 'problem',
        message: 'No carga el plan'
      }
    ]);
  });
});

/* `setHandled` (`0071`): the trail names who marked it, with the message's own id — never a person. */
describe('FeedbackController.setHandled', () => {
  beforeEach(() => {
    setHandled.mockReset();
    record.mockReset();
  });

  it('records feedback.handled with the message’s id as entityId, and the session as actor', async () => {
    setHandled.mockImplementation(async (_id, _handled, r) => {
      await r?.(undefined);

      return true;
    });

    await FeedbackController.setHandled('fb-1', true, 'usr-owner');

    expect(record).toHaveBeenCalledWith(
      { action: 'feedback.handled', actorId: 'usr-owner', entity: 'feedback', entityId: 'fb-1', metadata: {} },
      undefined
    );
  });

  it('records feedback.reopened when put back', async () => {
    setHandled.mockImplementation(async (_id, _handled, r) => {
      await r?.(undefined);

      return true;
    });

    await FeedbackController.setHandled('fb-1', false, 'usr-owner');

    expect(record).toHaveBeenCalledWith(
      { action: 'feedback.reopened', actorId: 'usr-owner', entity: 'feedback', entityId: 'fb-1', metadata: {} },
      undefined
    );
  });

  it('is a 404 for a message that does not exist', async () => {
    setHandled.mockResolvedValue(false);

    await expect(FeedbackController.setHandled('fb-missing', true, 'usr-owner')).rejects.toThrow(NotFoundError);
  });
});
