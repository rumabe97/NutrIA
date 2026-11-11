import { beforeEach, describe, expect, it, vi } from 'vitest';

import { allowancesFor } from 'core/domain/Allowance';
import { NotFoundError } from 'core/entities/Error';

import { AssistantController, conversationTitle, groupExport } from './AssistantController';

const repository = vi.hoisted(() => ({
  appendTurn: vi.fn(),
  claimUse: vi.fn(),
  createConversation: vi.fn(),
  deleteConversation: vi.fn(),
  deleteTurn: vi.fn(),
  everything: vi.fn(),
  findConversation: vi.fn(),
  forgetOldUsage: vi.fn(),
  forgetQuietConversations: vi.fn(),
  listConversations: vi.fn(),
  markOffTopic: vi.fn(),
  releaseUse: vi.fn(),
  turns: vi.fn(),
  usageSince: vi.fn()
}));
const plans = vi.hoisted(() => ({ findActive: vi.fn() }));

vi.mock('#repositories/Assistant', () => ({ AssistantRepository: repository }));
vi.mock('#repositories/Plan', () => ({ PlanRepository: plans }));
vi.mock('core/controllers/Plan', () => ({ PlanController: { limitsOf: () => Promise.resolve(allowancesFor('free')) } }));
vi.mock('core/controllers/Profile', () => ({ personToday: () => Promise.resolve('2026-11-15') }));

beforeEach(() => {
  vi.clearAllMocks();
  repository.usageSince.mockResolvedValue({ messages: 3, offTopic: 1 });
});

describe('conversationTitle', () => {
  it('is the first question, flattened, when it is short', () => {
    expect(conversationTitle('  ¿Por qué tanto\n almuerzo?  ')).toBe('¿Por qué tanto almuerzo?');
  });

  it('is cut on a word, with an ellipsis, when it is long', () => {
    const title = conversationTitle('Quiero saber por qué mi plan de esta quincena lleva tanta legumbre en las cenas de diario');

    expect(title.length).toBeLessThanOrEqual(61);
    expect(title.endsWith('…')).toBe(true);
    expect(title).not.toMatch(/\s…$/);
  });

  it('cuts a single long word where it must', () => {
    expect(conversationTitle('x'.repeat(80))).toBe(`${'x'.repeat(60)}…`);
  });
});

describe('AssistantController.standing', () => {
  it('counts over the plan in progress, from Madrid’s midnight of its first day', async () => {
    plans.findActive.mockResolvedValue({ endDate: '2026-11-23', startDate: '2026-11-10' });

    const standing = await AssistantController.standing('user-1');

    expect(standing).toMatchObject({ labelling: true, limit: 20, remaining: 17, used: 3, window: { resetsOn: '2026-11-24', since: '2026-11-10' } });
    expect(repository.usageSince).toHaveBeenCalledWith('user-1', new Date('2026-11-09T23:00:00Z'));
  });

  it('counts the last fourteen days for somebody with no plan', async () => {
    plans.findActive.mockResolvedValue(undefined);

    await expect(AssistantController.standing('user-1')).resolves.toMatchObject({ window: { resetsOn: null, since: '2026-11-02' } });
  });
});

describe('AssistantController.open', () => {
  it('starts a conversation titled from the question when none is named', async () => {
    repository.createConversation.mockResolvedValue('c-new');

    await expect(AssistantController.open('user-1', undefined, '¿Y el jueves?')).resolves.toBe('c-new');
    expect(repository.createConversation).toHaveBeenCalledWith('user-1', '¿Y el jueves?');
  });

  it('continues this person’s own conversation, and answers somebody else’s as one that does not exist', async () => {
    repository.findConversation.mockResolvedValueOnce({ id: 'c-1' });

    await expect(AssistantController.open('user-1', 'c-1', 'x')).resolves.toBe('c-1');

    repository.findConversation.mockResolvedValueOnce(null);

    await expect(AssistantController.open('user-2', 'c-1', 'x')).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('AssistantController reads and deletes', () => {
  it('returns a thread with its turns, or a 404', async () => {
    repository.findConversation.mockResolvedValueOnce({ id: 'c-1', title: 'x' });
    repository.turns.mockResolvedValueOnce([{ id: 't-1' }]);

    await expect(AssistantController.thread('user-1', 'c-1')).resolves.toEqual({ conversation: { id: 'c-1', title: 'x' }, turns: [{ id: 't-1' }] });

    repository.findConversation.mockResolvedValueOnce(null);

    await expect(AssistantController.thread('user-2', 'c-1')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('deletes what is this person’s, and answers anything else as not found', async () => {
    repository.deleteConversation.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    repository.deleteTurn.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    await expect(AssistantController.deleteConversation('user-1', 'c-1')).resolves.toBeUndefined();
    await expect(AssistantController.deleteConversation('user-2', 'c-1')).rejects.toBeInstanceOf(NotFoundError);
    await expect(AssistantController.deleteTurn('user-1', 't-1')).resolves.toBeUndefined();
    // The first question's words leave the title with it: the repository is handed the titling rule.
    expect(repository.deleteTurn).toHaveBeenCalledWith('user-1', 't-1', conversationTitle);
    await expect(AssistantController.deleteTurn('user-2', 't-1')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('passes the rest straight through, and refuses an append to somebody else’s conversation', async () => {
    repository.listConversations.mockResolvedValueOnce([]);
    repository.appendTurn.mockResolvedValueOnce('t-1').mockResolvedValueOnce(null);

    await AssistantController.markOffTopic('user-1', 'u-1');
    await AssistantController.release('user-1', 'u-2');
    await expect(AssistantController.conversations('user-1')).resolves.toEqual([]);
    await expect(AssistantController.append('user-1', 'c-1', { content: '', decline: 'off_topic', role: 'assistant' })).resolves.toBe('t-1');
    await expect(AssistantController.append('user-2', 'c-1', { content: 'x', decline: null, role: 'user' })).rejects.toBeInstanceOf(NotFoundError);
    expect(repository.markOffTopic).toHaveBeenCalledWith('user-1', 'u-1');
    expect(repository.releaseUse).toHaveBeenCalledWith('user-1', 'u-2');
  });
});

describe('AssistantController.claim', () => {
  const standing = { limit: 20, window: { resetsOn: '2026-11-24', since: '2026-11-10' } } as never;

  it('claims one message against the window, from Madrid’s midnight', async () => {
    repository.claimUse.mockResolvedValueOnce('u-1');

    await expect(AssistantController.claim('user-1', standing)).resolves.toBe('u-1');
    expect(repository.claimUse).toHaveBeenCalledWith('user-1', new Date('2026-11-09T23:00:00Z'), 20);
  });

  it('answers 429 when a message sent at the same moment took the last one', async () => {
    repository.claimUse.mockResolvedValueOnce(null);

    await expect(AssistantController.claim('user-1', standing)).rejects.toMatchObject({ kind: 'assistant_message', nextAt: '2026-11-24' });
  });
});

describe('AssistantController.forget', () => {
  it('deletes conversations quiet for six months and count rows past sixty days, by date alone', async () => {
    repository.forgetQuietConversations.mockResolvedValueOnce(2);
    repository.forgetOldUsage.mockResolvedValueOnce(9);

    await expect(AssistantController.forget(new Date('2026-11-10T10:00:00Z'))).resolves.toEqual({ assistantConversations: 2, assistantUsageRows: 9 });
    expect(repository.forgetQuietConversations).toHaveBeenCalledWith(new Date('2026-05-10T10:00:00Z'));
    expect(repository.forgetOldUsage).toHaveBeenCalledWith(new Date('2026-09-11T10:00:00Z'));
  });
});

describe('the copy a person downloads', () => {
  const at = (minute: number) => new Date(`2026-11-11T10:${String(minute).padStart(2, '0')}:00Z`);
  const row = (conversationId: string, role: 'assistant' | 'user' | null, minute: number, content: string | null = 'x') => ({
    content,
    conversationCreatedAt: at(0),
    conversationId,
    conversationUpdatedAt: at(9),
    decline: null,
    role,
    title: `t-${conversationId}`,
    turnCreatedAt: role === null ? null : at(minute)
  });

  it('groups the rows into conversations, turns in order, and keeps an empty one empty', () => {
    const grouped = groupExport([row('c-1', 'user', 1, 'Hola'), row('c-1', 'assistant', 2, 'Buenas'), row('c-2', null, 0, null)]);

    expect(grouped).toEqual([
      {
        id: 'c-1',
        createdAt: at(0),
        title: 't-c-1',
        turns: [
          { content: 'Hola', createdAt: at(1), decline: null, role: 'user' },
          { content: 'Buenas', createdAt: at(2), decline: null, role: 'assistant' }
        ],
        updatedAt: at(9)
      },
      { id: 'c-2', createdAt: at(0), title: 't-c-2', turns: [], updatedAt: at(9) }
    ]);
  });

  it('is read through the person’s own id, and says when it was made', async () => {
    repository.everything.mockResolvedValue([]);
    const now = new Date('2026-11-11T12:00:00Z');

    await expect(AssistantController.everything('user-1', now)).resolves.toEqual({ conversations: [], exportedAt: now });
    expect(repository.everything).toHaveBeenCalledWith('user-1');
  });
});
