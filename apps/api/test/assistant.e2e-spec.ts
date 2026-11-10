import { randomBytes } from 'node:crypto';

import compression from 'compression';
import express from 'express';
import helmet from 'helmet';
import { Test } from '@nestjs/testing';

import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';

import { SettingsController } from 'core/controllers/Settings';
import { TextSpend } from 'core/controllers/Analytics';
import { UNAUDITED } from 'core/entities/Audit';
import { allowancesFor } from 'core/domain/Allowance';
import { database } from 'database';

import { AppModule } from '../src/app.module.js';
import { ASSISTANT_CLIENT } from '../src/modules/ai/ai.config.js';
import { AiClient } from '../src/modules/ai/clients/AiClient.js';
import { StreamingAiClient } from '../src/modules/ai/clients/StreamingAiClient.js';
import { completeOnboarding, createApp, deleteAccounts, generateAndWait, httpServer, POOL, PREFIX, register, ScriptedAiClient } from './harness.js';

import type { Account } from './harness.js';
import type { AiRequest, AiResponse } from '../src/modules/ai/clients/AiClient.js';
import type { AiStream, AiStreamRequest } from '../src/modules/ai/clients/StreamingAiClient.js';
import type { INestApplication } from '@nestjs/common';
import type { TestingModuleBuilder } from '@nestjs/testing';
import type { Response } from 'supertest';

type Sql = <Row>(strings: TemplateStringsArray, ...values: readonly unknown[]) => Promise<Row[]>;

function sql(): Sql {
  return (database() as unknown as { readonly $client: Sql }).$client;
}

type Event = { readonly id?: string; readonly decline?: string | null; readonly text?: string; readonly type: string };
type Standing = {
  readonly allowed: boolean;
  readonly labelling: boolean;
  readonly limit: number;
  readonly remaining: number;
  readonly resetsOn: string | null;
  readonly used: number;
};

/** The label a question gets, one per call, `nutrition` when the script runs out. */
class ScriptedLabeller extends AiClient {
  public calls = 0;
  public readonly labels: string[] = [];

  get isAvailable(): boolean {
    return true;
  }

  generate<T>(_request: AiRequest<T>): Promise<AiResponse<T>> {
    this.calls += 1;

    const label = this.labels.shift() ?? 'nutrition';

    return Promise.resolve({ object: { label } as T, usage: { calls: 1, inputTokens: 0, model: 'scripted', outputTokens: 0 } });
  }
}

/**
 * The answer, in the chunks it is written in, one script per call. A script
 * runs out to a plain, safe sentence. Every request is kept, so a suite can
 * assert what the model was — and was not — told.
 */
class ScriptedStreamer extends StreamingAiClient {
  public readonly answers: (readonly string[])[] = [];
  public readonly requests: AiStreamRequest[] = [];

  constructor(private readonly delayMs = 5) {
    super();
  }

  get calls(): number {
    return this.requests.length;
  }

  get isAvailable(): boolean {
    return true;
  }

  stream(request: AiStreamRequest): AiStream {
    this.requests.push(request);

    const chunks = this.answers.shift() ?? ['Las legumbres ', 'aportan fibra. ', 'Puedes tomarlas varias veces por semana.'];
    const delayMs = this.delayMs;

    return {
      finished: Promise.resolve({ call: { model: 'scripted' } as never, usage: { calls: 1, inputTokens: 0, model: 'scripted', outputTokens: 0 } }),
      text: (async function* text(): AsyncGenerator<string> {
        for (const chunk of chunks) {
          await new Promise(resolve => setTimeout(resolve, delayMs));

          yield chunk;
        }
      })()
    };
  }
}

/** The assistant's two clients replaced, and nothing else. */
function withAssistant(labeller: ScriptedLabeller, streamer: ScriptedStreamer) {
  return (builder: TestingModuleBuilder): TestingModuleBuilder =>
    builder.overrideProvider(ASSISTANT_CLIENT).useValue(labeller).overrideProvider(StreamingAiClient).useValue(streamer);
}

/** The body as it arrived, NDJSON read line by line. */
function ndjson(response: Response): readonly Event[] {
  return String(response.body)
    .split('\n')
    .filter(line => line !== '')
    .map(line => JSON.parse(line) as Event);
}

function textOf(events: readonly Event[]): string {
  return events
    .filter(event => event.type === 'text')
    .map(event => event.text)
    .join('');
}

function endOf(events: readonly Event[]): Event | undefined {
  return events.find(event => event.type === 'end');
}

const FREE_MESSAGES = 4;
const FREE_OFF_TOPIC = 1;

/**
 * The assistant's route (project 023 phase 4): a stream back for a signed-in
 * person, under every limit, in a thread only they can reach, and every screen
 * between the model and the screen enforced in code (`0104`, `0105`).
 *
 * Both clients are scripted — the label and the answer — so a refusal here is
 * the code refusing, never a model being polite.
 */
describe('the assistant (023 phase 4)', () => {
  let app: INestApplication;
  const labeller = new ScriptedLabeller();
  const streamer = new ScriptedStreamer();
  const made: string[] = [];
  const shipped = allowancesFor('free');

  const make = async (label: string, allergenIds: readonly string[] = []): Promise<Account> => {
    const account = await register(app, `assistant-${label}-${randomBytes(4).toString('hex')}@e2e.invalid`);

    made.push(account.cookie);
    await completeOnboarding(app, account, allergenIds);

    return account;
  };

  const server = () => httpServer(app);
  const ask = (account: Account, body: Record<string, unknown>) =>
    request(server())
      .post(`/${PREFIX}/assistant/messages`)
      .set('Cookie', account.cookie)
      .send(body)
      .buffer(true)
      .parse((response, done) => {
        let text = '';

        response.setEncoding('utf8');
        response.on('data', (chunk: string) => (text += chunk));
        response.on('end', () => done(null, text));
      });
  const standing = async (account: Account): Promise<Standing> =>
    (await request(server()).get(`/${PREFIX}/assistant/standing`).set('Cookie', account.cookie).expect(200)).body as Standing;

  beforeAll(async () => {
    app = await createApp(new ScriptedAiClient(POOL), withAssistant(labeller, streamer));
    await SettingsController.setAllowance({ name: 'assistantMessagesPerFortnight', tier: 'free', value: FREE_MESSAGES }, UNAUDITED);
    await SettingsController.setAllowance({ name: 'assistantOffTopicPerFortnight', tier: 'free', value: FREE_OFF_TOPIC }, UNAUDITED);
    await SettingsController.setFlag('assistant', true, UNAUDITED);
  });

  afterAll(async () => {
    await SettingsController.setFlag('assistant', false, UNAUDITED);
    await SettingsController.setAllowance(
      { name: 'assistantMessagesPerFortnight', tier: 'free', value: shipped.assistantMessagesPerFortnight },
      UNAUDITED
    );
    await SettingsController.setAllowance(
      { name: 'assistantOffTopicPerFortnight', tier: 'free', value: shipped.assistantOffTopicPerFortnight },
      UNAUDITED
    );
    await deleteAccounts(app, made);
    await app.close();
  });

  it('cannot be asked while its switch is off — a 404 even for an unfinished account — and still lets people delete what they said', async () => {
    const person = await make('off');
    const unfinished = await register(app, `assistant-unfinished-${randomBytes(4).toString('hex')}@e2e.invalid`);

    made.push(unfinished.cookie);
    await SettingsController.setFlag('assistant', false, UNAUDITED);

    try {
      for (const account of [person, unfinished]) {
        await request(server()).get(`/${PREFIX}/assistant/standing`).set('Cookie', account.cookie).expect(404);
        await ask(account, { message: '¿Qué llevan las lentejas?' }).expect(404);
      }

      // Reading and deleting one's own words never sit behind the switch (PRD 10).
      expect((await request(server()).get(`/${PREFIX}/assistant/conversations`).set('Cookie', person.cookie).expect(200)).body).toEqual([]);
      expect(streamer.calls + labeller.calls).toBe(0);
    } finally {
      await SettingsController.setFlag('assistant', true, UNAUDITED);
    }

    // On, an unfinished account is told to finish, like every route that needs a profile.
    expect((await request(server()).get(`/${PREFIX}/assistant/standing`).set('Cookie', unfinished.cookie).expect(409)).body).toMatchObject({
      code: 'ONBOARDING_INCOMPLETE'
    });
  });

  it('refuses every route without a session, with 404 rather than 401, like every protected route', async () => {
    await request(server()).get(`/${PREFIX}/assistant/standing`).expect(404);
    await request(server()).get(`/${PREFIX}/assistant/conversations`).expect(404);
    await request(server()).post(`/${PREFIX}/assistant/messages`).send({ message: 'hola' }).expect(404);
    expect(streamer.calls + labeller.calls).toBe(0);
  });

  it('streams an answer, as NDJSON nobody may buffer, into a thread the person owns', async () => {
    const person = await make('stream');
    const response = await ask(person, { message: '¿Por qué llevo tanta legumbre?' }).expect(200);

    expect(response.headers['content-type']).toMatch(/^application\/x-ndjson/);
    expect(response.headers['cache-control']).toContain('no-transform');

    const events = ndjson(response);
    const conversationId = events[0]?.id;

    expect(events[0]?.type).toBe('conversation');
    expect(events.filter(event => event.type === 'text').length).toBeGreaterThanOrEqual(2);
    expect(textOf(events)).toBe('Las legumbres aportan fibra. Puedes tomarlas varias veces por semana.');
    expect(endOf(events)).toEqual({ decline: null, type: 'end' });

    // The model was told the plan generator's context and the question, and a history of none.
    const told = streamer.requests.at(-1);

    expect(told?.messages).toEqual([{ role: 'user', text: '¿Por qué llevo tanta legumbre?' }]);
    expect(told?.feature).toBe('assistant');

    // A second question in the same thread replays the first exchange.
    await ask(person, { conversationId, message: '¿Y el garbanzo?' }).expect(200);

    expect(streamer.requests.at(-1)?.messages).toEqual([
      { role: 'user', text: '¿Por qué llevo tanta legumbre?' },
      { role: 'assistant', text: 'Las legumbres aportan fibra. Puedes tomarlas varias veces por semana.' },
      { role: 'user', text: '¿Y el garbanzo?' }
    ]);

    const thread = (
      await request(server())
        .get(`/${PREFIX}/assistant/conversations/${String(conversationId)}`)
        .set('Cookie', person.cookie)
        .expect(200)
    ).body as { conversation: { id: string; title: string }; turns: { content: string; role: string }[] };

    expect(thread.conversation.title).toBe('¿Por qué llevo tanta legumbre?');
    expect(thread.turns.map(turn => turn.role)).toEqual(['user', 'assistant', 'user', 'assistant']);
    expect((await standing(person)).used).toBe(2);
  });

  it('refuses a message too long, as invalid input, and counts nothing', async () => {
    const person = await make('long');

    await ask(person, { message: 'a'.repeat(1001) }).expect(422);
    await ask(person, { message: '   ' }).expect(422);
    expect((await standing(person)).used).toBe(0);
  });

  it('counts the fortnight’s messages and refuses the next one, with no call; with no plan, over fourteen days', async () => {
    const person = await make('allowance');
    const before = streamer.calls;

    for (let sent = 0; sent < FREE_MESSAGES; sent += 1) {
      await ask(person, { message: `¿Cuánta fibra tiene la avena? (${String(sent)})` }).expect(200);
    }

    const spent = await standing(person);

    expect(spent).toMatchObject({ allowed: false, limit: FREE_MESSAGES, remaining: 0, resetsOn: null, used: FREE_MESSAGES });

    const refused = await ask(person, { message: 'Una más' }).expect(429);

    expect((JSON.parse(String(refused.body)) as { code: string }).code).toBe('QUOTA_EXCEEDED');
    expect(streamer.calls - before).toBe(FREE_MESSAGES);
  });

  it('lets exactly one of a burst through when one message is left', async () => {
    const person = await make('burst');

    for (let sent = 0; sent < FREE_MESSAGES - 1; sent += 1) {
      await ask(person, { message: `¿Y la fibra? (${String(sent)})` }).expect(200);
    }

    const statuses = (await Promise.all(Array.from({ length: 5 }, (_, index) => ask(person, { message: `A la vez (${String(index)})` })))).map(
      response => response.status
    );

    expect(statuses.filter(status => status === 200)).toHaveLength(1);
    expect(statuses.filter(status => status === 429)).toHaveLength(4);
    expect((await standing(person)).used).toBe(FREE_MESSAGES);
  });

  it('counts over the active plan’s fortnight once there is one, and resets the day after it ends', async () => {
    const person = await make('planned');

    expect((await generateAndWait(app, person)).status).toBe('succeeded');

    const view = await standing(person);
    const [plan] = await sql()<{
      endDate: string;
    }>`select end_date::text as "endDate" from meal_plans where user_id = ${person.id} and status = 'active'`;
    const dayAfter = new Date(`${String(plan?.endDate)}T00:00:00Z`);

    dayAfter.setUTCDate(dayAfter.getUTCDate() + 1);
    expect(view.resetsOn).toBe(dayAfter.toISOString().slice(0, 10));
  });

  it('refuses a clinical question before any call, with the model stubbed to help', async () => {
    const person = await make('clinical');
    const before = { labels: labeller.calls, streams: streamer.calls };

    streamer.answers.push(['Ponte doce unidades.']);

    const events = ndjson(await ask(person, { message: '¿Cuántas unidades de insulina me pongo?' }).expect(200));

    expect(textOf(events)).toBe('');
    expect(endOf(events)).toEqual({ decline: 'clinical', type: 'end' });
    expect({ labels: labeller.calls, streams: streamer.calls }).toEqual(before);

    // Judged clinical by the code itself, so not kept: neither the words nor a title made of them (legal F2).
    const [kept] = await sql()<{ texts: string | null; titles: string | null }>`
      select string_agg(m.content, '|') as texts, string_agg(distinct c.title, '|') as titles
      from ai_conversations c join ai_messages m on m.conversation_id = c.id where c.user_id = ${person.id}`;

    expect(`${String(kept?.texts)} ${String(kept?.titles)}`).not.toContain('insulina');
    streamer.answers.length = 0;
  });

  it('cuts an off-topic question without writing a word, and past the ceiling asks no model at all', async () => {
    const person = await make('off-topic');
    const streams = streamer.calls;

    labeller.labels.push('off_topic');
    streamer.answers.push(['El Real Madrid ganó ', 'la liga en 2024.']);

    const first = ndjson(await ask(person, { message: '¿Quién ganó la liga?' }).expect(200));

    expect(textOf(first)).toBe('');
    expect(endOf(first)).toEqual({ decline: 'off_topic', type: 'end' });
    expect(streamer.calls).toBe(streams);
    expect((await standing(person)).labelling).toBe(false);

    // Past the off-topic ceiling: the standing sentence, and neither model asked.
    const labels = labeller.calls;
    const second = ndjson(await ask(person, { message: '¿Qué tiempo hace en Madrid?' }).expect(200));

    expect(endOf(second)).toEqual({ decline: 'off_topic', type: 'end' });
    expect(labeller.calls).toBe(labels);
    expect(streamer.calls).toBe(streams);
    streamer.answers.length = 0;
  });

  it('never shows an invented figure: the sentence carrying it is withheld, the ones before it stay', async () => {
    const person = await make('figure');

    streamer.answers.push(['La avena es un buen desayuno. ', 'Tu objetivo son 4321 kcal al día. ', 'Acompáñala de fruta.']);

    const events = ndjson(await ask(person, { message: '¿Cuántas calorías debo comer?' }).expect(200));

    expect(textOf(events)).toBe('La avena es un buen desayuno. ');
    expect(textOf(events)).not.toContain('4321');
    expect(endOf(events)).toEqual({ decline: 'invented_figure', type: 'end' });

    // What was shown is what is stored: the withheld sentence is nowhere.
    const [stored] = await sql()<{ text: string }>`
      select string_agg(m.content, ' ') as text from ai_messages m join ai_conversations c on c.id = m.conversation_id where c.user_id = ${person.id}`;

    expect(stored?.text).not.toContain('4321');
  });

  it('withholds an answer that names a declared allergen', async () => {
    const [milk] = await sql()<{ id: string }>`select id from allergens where key = 'milk'`;
    const person = await make('allergen', [String(milk?.id)]);

    streamer.answers.push(['Un vaso de leche entera ', 'antes de dormir te ayuda.']);

    const events = ndjson(await ask(person, { message: '¿Qué ceno si tengo hambre tarde?' }).expect(200));

    expect(textOf(events).toLowerCase()).not.toContain('leche');
    expect(endOf(events)).toEqual({ decline: 'allergen', type: 'end' });
    // The net works on our side: the model was never told what this person cannot eat (legal F1).
    expect(streamer.requests.at(-1)?.system.toLowerCase()).not.toMatch(/leche|milk/);
  });

  it('withholds a food that contains the allergen, even split across two chunks, and answers screened again once an allergy is declared', async () => {
    const [milk] = await sql()<{ id: string }>`select id from allergens where key = 'milk'`;
    const [food] = await sql()<{ name: string }>`
      select n.name from ingredient_names n join ingredient_allergens ia on ia.ingredient_id = n.ingredient_id
      where ia.allergen_id = ${String(milk?.id)} and ia.presence = 'contains' and n.locale = 'es-ES' and n.name not ilike '%leche%'
      order by n.name limit 1`;
    const name = String(food?.name).toLowerCase();
    const allergic = await make('contains', [String(milk?.id)]);

    streamer.answers.push(['Para merendar, un poco de ', name.slice(0, 3), `${name.slice(3)} con fruta.`]);

    const events = ndjson(await ask(allergic, { message: '¿Qué meriendo?' }).expect(200));

    expect(textOf(events).toLowerCase()).not.toContain(name);
    expect(endOf(events)).toEqual({ decline: 'allergen', type: 'end' });

    // Said before the allergy, screened after it: the stored answer reads as withheld, and is not replayed.
    const later = await make('later');
    const first = ndjson(await ask(later, { message: '¿Qué ceno?' }).expect(200));
    const conversationId = String(first[0]?.id);

    streamer.answers.push([`Una tortilla con ${name}.`]);
    await ask(later, { conversationId, message: '¿Y mañana?' }).expect(200);
    await request(server())
      .put(`/${PREFIX}/safety/restrictions`)
      .set('Cookie', later.cookie)
      .send({
        allergies: [{ allergenId: String(milk?.id), crossContaminationSensitive: false, severity: 'moderate' }],
        customAllergens: [],
        intolerances: []
      })
      .expect(204);

    const thread = (await request(server()).get(`/${PREFIX}/assistant/conversations/${conversationId}`).set('Cookie', later.cookie).expect(200))
      .body as { turns: { content: string; decline: string | null; role: string }[] };

    expect(thread.turns.at(-1)).toMatchObject({ content: '', decline: 'allergen', role: 'assistant' });

    await ask(later, { conversationId, message: '¿Y pasado?' }).expect(200);
    expect(JSON.stringify(streamer.requests.at(-1)?.messages).toLowerCase()).not.toContain(name);
  });

  it('withholds a free-text allergy it was never told about, and never tells the model', async () => {
    const person = await make('custom');

    await request(server())
      .put(`/${PREFIX}/safety/restrictions`)
      .set('Cookie', person.cookie)
      .send({ allergies: [], customAllergens: ['zarzaparrilla'], intolerances: [] })
      .expect(204);
    streamer.answers.push(['Prueba un batido con zarzaparrilla.']);

    const events = ndjson(await ask(person, { message: '¿Un batido para después de entrenar?' }).expect(200));

    expect(endOf(events)).toEqual({ decline: 'allergen', type: 'end' });
    expect(textOf(events)).not.toContain('zarzaparrilla');
    expect(streamer.requests.at(-1)?.system.toLowerCase()).not.toContain('zarzaparrilla');
  });

  it('cuts an answer that writes a plan, and generates nothing', async () => {
    const person = await make('acting');
    const [before] = await sql()<{ plans: number }>`select count(*)::int as plans from meal_plans where user_id = ${person.id}`;

    streamer.answers.push(['Lunes: lentejas. ', 'Martes: pollo. ', 'Miércoles: merluza. ', 'Jueves: garbanzos. ', 'Viernes: arroz.']);

    const events = ndjson(await ask(person, { message: 'Hazme el plan de las dos semanas' }).expect(200));
    const [after] = await sql()<{ plans: number }>`select count(*)::int as plans from meal_plans where user_id = ${person.id}`;

    expect(endOf(events)).toEqual({ decline: 'acting', type: 'end' });
    expect(textOf(events)).not.toContain('Viernes');
    expect(after?.plans).toBe(before?.plans);
  });

  it('keeps every conversation its owner’s: a second person gets a 404 on every route', async () => {
    const owner = await make('owner');
    const other = await make('other');
    const events = ndjson(await ask(owner, { message: '¿Es buena la merluza?' }).expect(200));
    const conversationId = String(events[0]?.id);
    const [turn] = await sql()<{ id: string }>`select id from ai_messages where conversation_id = ${conversationId} limit 1`;
    const as = (account: Account) => ({
      del: (path: string) => request(server()).delete(`/${PREFIX}/assistant/${path}`).set('Cookie', account.cookie),
      get: (path: string) => request(server()).get(`/${PREFIX}/assistant/${path}`).set('Cookie', account.cookie)
    });

    await as(other).get(`conversations/${conversationId}`).expect(404);
    await as(other).del(`conversations/${conversationId}`).expect(404);
    await as(other)
      .del(`messages/${String(turn?.id)}`)
      .expect(404);
    const labels = labeller.calls;

    await ask(other, { conversationId, message: 'Y yo, ¿qué?' }).expect(404);
    expect(labeller.calls).toBe(labels);
    expect((await standing(other)).used).toBe(0);
    expect((await as(other).get('conversations').expect(200)).body).toEqual([]);

    // Still whole for its owner.
    const thread = (await as(owner).get(`conversations/${conversationId}`).expect(200)).body as { turns: unknown[] };

    expect(thread.turns).toHaveLength(2);
  });

  it('deletes a conversation with its turns, and the message stays counted', async () => {
    const person = await make('delete');
    const events = ndjson(await ask(person, { message: '¿Cuánta proteína tiene el huevo?' }).expect(200));
    const conversationId = String(events[0]?.id);
    const used = (await standing(person)).used;

    await request(server()).delete(`/${PREFIX}/assistant/conversations/${conversationId}`).set('Cookie', person.cookie).expect(204);
    await request(server()).get(`/${PREFIX}/assistant/conversations/${conversationId}`).set('Cookie', person.cookie).expect(404);

    const [left] = await sql()<{ turns: number }>`select count(*)::int as turns from ai_messages where conversation_id = ${conversationId}`;

    expect(left?.turns).toBe(0);
    expect((await standing(person)).used).toBe(used);
  });

  it('deletes one turn of a conversation, and only that one', async () => {
    const person = await make('turn');
    const events = ndjson(await ask(person, { message: '¿El arroz integral sacia más?' }).expect(200));
    const conversationId = String(events[0]?.id);
    const [first] = await sql()<{ id: string }>`select id from ai_messages where conversation_id = ${conversationId} and role = 'user'`;

    await request(server())
      .delete(`/${PREFIX}/assistant/messages/${String(first?.id)}`)
      .set('Cookie', person.cookie)
      .expect(204);

    const thread = (await request(server()).get(`/${PREFIX}/assistant/conversations/${conversationId}`).set('Cookie', person.cookie).expect(200))
      .body as { turns: { role: string }[] };

    expect(thread.turns.map(turn => turn.role)).toEqual(['assistant']);
  });

  it('takes a deleted first question’s words from the title too', async () => {
    const person = await make('title');
    const first = ndjson(await ask(person, { message: 'Tomo pastillas para la tensión, ¿qué ceno?' }).expect(200));
    const conversationId = String(first[0]?.id);

    await ask(person, { conversationId, message: '¿Y de postre?' }).expect(200);

    const [question] = await sql()<{ id: string }>`
      select id from ai_messages where conversation_id = ${conversationId} and role = 'user' order by created_at, id limit 1`;

    await request(server())
      .delete(`/${PREFIX}/assistant/messages/${String(question?.id)}`)
      .set('Cookie', person.cookie)
      .expect(204);

    const list = (await request(server()).get(`/${PREFIX}/assistant/conversations`).set('Cookie', person.cookie).expect(200)).body as {
      title: string;
    }[];

    expect(list[0]?.title).toBe('¿Y de postre?');
    expect(JSON.stringify(list)).not.toContain('pastillas');
  });

  it('leaves nothing of what was said once the account is deleted', async () => {
    const person = await make('gone');

    await ask(person, { message: '¿Es sano cenar tarde?' }).expect(200);
    await deleteAccounts(app, [person.cookie]);
    made.splice(made.indexOf(person.cookie), 1);

    const [left] = await sql()<{ conversations: number; usage: number }>`
      select (select count(*)::int from ai_conversations where user_id = ${person.id}) as conversations,
             (select count(*)::int from assistant_usage where user_id = ${person.id}) as usage`;

    expect(left).toEqual({ conversations: 0, usage: 0 });
  });
});

/**
 * The assistant's own ceiling (`AI_ASSISTANT_MONTHLY_CAP_USD`): reached, it
 * refuses everybody with a 503 and counts nothing — and the plan generator, on
 * the other budget, carries on, and the text gauge that holds the nightly
 * rewrite does not see the assistant's dollars at all.
 */
describe('the assistant past its month’s ceiling (023 phase 4)', () => {
  const TAG = 'assistant-cap-e2e';
  let app: INestApplication;
  const labeller = new ScriptedLabeller();
  const streamer = new ScriptedStreamer();
  const made: string[] = [];
  const previous = process.env['AI_ASSISTANT_MONTHLY_CAP_USD'];

  beforeAll(async () => {
    const [spent] = await sql()<{ spent: string | null }>`
      select sum((properties ->> 'costUsd')::numeric) as spent from analytics_events
      where event = 'ai_call' and properties ->> 'feature' = 'assistant' and created_at >= date_trunc('month', now() at time zone 'UTC')`;
    const cap = Math.ceil(Number(spent?.spent ?? 0)) + 1;

    process.env['AI_ASSISTANT_MONTHLY_CAP_USD'] = String(cap);
    app = await createApp(new ScriptedAiClient(POOL), withAssistant(labeller, streamer));
    await SettingsController.setFlag('assistant', true, UNAUDITED);
  });

  afterAll(async () => {
    await sql()`delete from analytics_events where event = 'ai_call' and properties ->> 'model' = ${TAG}`;
    await SettingsController.setFlag('assistant', false, UNAUDITED);
    await deleteAccounts(app, made);
    await app.close();

    if (previous === undefined) {
      delete process.env['AI_ASSISTANT_MONTHLY_CAP_USD'];
    } else {
      process.env['AI_ASSISTANT_MONTHLY_CAP_USD'] = previous;
    }
  });

  it('refuses everybody with a 503 and counts nothing, while plans are still generated and the text gauge does not move', async () => {
    const person = await register(app, `assistant-cap-${randomBytes(4).toString('hex')}@e2e.invalid`);

    made.push(person.cookie);
    await completeOnboarding(app, person);

    const gaugeBefore = await TextSpend.gauge(1_000_000);

    await sql()`
      insert into analytics_events (event, user_id, properties, created_at)
      values ('ai_call', null, ${JSON.stringify({ costUsd: Number(process.env['AI_ASSISTANT_MONTHLY_CAP_USD']), feature: 'assistant', model: TAG })}::jsonb, now())`;

    const refused = await request(httpServer(app))
      .post(`/${PREFIX}/assistant/messages`)
      .set('Cookie', person.cookie)
      .send({ message: '¿Qué es la fibra?' })
      .expect(503);

    expect(refused.body).toMatchObject({ code: 'ASSISTANT_UNAVAILABLE', message: 'budget' });
    expect(labeller.calls + streamer.calls).toBe(0);

    const view = (await request(httpServer(app)).get(`/${PREFIX}/assistant/standing`).set('Cookie', person.cookie).expect(200)).body as Standing;

    expect(view.used).toBe(0);
    expect(await TextSpend.gauge(1_000_000)).toEqual(gaugeBefore);
    expect((await generateAndWait(app, person)).status).toBe('succeeded');
  });
});

/**
 * The answer arrives while it is written, through the same compression the
 * deployed function puts in front of every route (`CreateApp.ts`): measured on
 * 2026-11-09, `compression` held a compressible body whole until it ended, and
 * `Cache-Control: no-transform` is what lets this one through. The harness's
 * application has no compression, so this one is assembled with it — helmet and
 * compression, in `CreateApp`'s order — and read over a real socket, chunk by
 * chunk, asking for gzip the way a browser does.
 *
 * What this cannot prove is whether the platform's own layer buffers: that
 * rests on phase 5's look on a phone.
 */
describe('the assistant’s answer through compression (023 phase 4)', () => {
  let app: INestApplication;
  let base = '';
  const streamer = new ScriptedStreamer(250);
  const made: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AiClient)
      .useValue(new ScriptedAiClient(POOL))
      .overrideProvider(ASSISTANT_CLIENT)
      .useValue(new ScriptedLabeller())
      .overrideProvider(StreamingAiClient)
      .useValue(streamer)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix(PREFIX);
    app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));
    app.use(compression());
    app.use(`/${PREFIX}/auth`, (_q: express.Request, _s: express.Response, next: express.NextFunction) => next());
    app.use(express.json());
    await app.init();
    await app.listen(0, '127.0.0.1');
    base = await app.getUrl();
    await SettingsController.setFlag('assistant', true, UNAUDITED);
  });

  afterAll(async () => {
    await SettingsController.setFlag('assistant', false, UNAUDITED);
    await deleteAccounts(app, made);
    await app.close();
  });

  it('arrives in more than one piece, each when it was written, with gzip asked for', async () => {
    const person = await register(app, `assistant-chunks-${randomBytes(4).toString('hex')}@e2e.invalid`);

    made.push(person.cookie);
    await completeOnboarding(app, person);

    const started = Date.now();
    const response = await fetch(`${base.replace('[::1]', '127.0.0.1')}/${PREFIX}/assistant/messages`, {
      body: JSON.stringify({ message: '¿Por qué llevo tanta legumbre?' }),
      headers: { 'accept-encoding': 'gzip', 'content-type': 'application/json', cookie: person.cookie },
      method: 'POST'
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-encoding')).toBeNull();

    const arrivals: number[] = [];
    const reader = response.body?.getReader();

    for (;;) {
      const next = await reader?.read();

      if (!next || next.done) {
        break;
      }

      arrivals.push(Date.now() - started);
    }

    // Three chunks written 250 ms apart: a buffered body is one arrival at the end.
    expect(arrivals.length).toBeGreaterThanOrEqual(2);
    expect((arrivals.at(-1) ?? 0) - (arrivals[0] ?? 0)).toBeGreaterThanOrEqual(200);
  });
});
