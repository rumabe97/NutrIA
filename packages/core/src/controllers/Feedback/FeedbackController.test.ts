import { beforeEach, describe, expect, it, vi } from 'vitest';

import { feedbackQuerySchema } from 'core/entities/AdminQuery';

import { FeedbackController } from './FeedbackController';

import type { FeedbackQuery } from 'core/entities/AdminQuery';
import type { FeedbackRow } from '#repositories/Feedback';

const findAll = vi.fn<(query: FeedbackQuery) => Promise<{ rows: readonly FeedbackRow[]; total: number; waiting: number }>>();

vi.mock('#repositories/Feedback', () => ({ FeedbackRepository: { findAll: (query: FeedbackQuery) => findAll(query) } }));

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
