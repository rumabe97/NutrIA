import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

import { forgetOfflineCopies, OFFLINE_PAGES_CACHE, OFFLINE_PATHS, refreshOfflineCopies, storedPages } from './offline';

/*
 * The worker is plain JavaScript served as is from `public/`, so this loads that
 * very file into a sandbox with a fake cache, network and clock, and drives it
 * with the events a browser would send.
 */
const SOURCE = readFileSync(new URL('../../public/sw.js', import.meta.url), 'utf8');
const ORIGIN = 'https://nutria.test';
const PAGES = OFFLINE_PAGES_CACHE;
const ASSETS = 'nutria-assets-v1';

type Answer = () => Promise<Response>;
type Listener = (event: Record<string, unknown>) => void;
type Key = { url: string } | string;

function at(path: string): string {
  return new URL(path, ORIGIN).href;
}

function keyOf(key: Key): string {
  return at(typeof key === 'string' ? key : key.url);
}

function page(...assets: readonly string[]): Answer {
  return async () =>
    new Response(`<html>${assets.map(asset => `<script src="${asset}"></script>`).join('')}</html>`, { headers: { 'Content-Type': 'text/html' } });
}

async function unreachable(): Promise<Response> {
  throw new TypeError('Failed to fetch');
}

/** What a navigation with `redirect: 'manual'` gets back when the server redirects. */
async function redirected(): Promise<Response> {
  const response = { headers: new Headers(), ok: false, redirected: false, status: 0, type: 'opaqueredirect' };

  return { ...response, clone: () => response } as unknown as Response;
}

class FakeCache {
  readonly entries = new Map<string, Response>();

  constructor(private readonly network: (input: Key) => Promise<Response>) {}

  async add(url: string): Promise<void> {
    const response = await this.network(url);

    if (!response.ok) {
      throw new TypeError('Bad response');
    }

    this.entries.set(keyOf(url), response);
  }

  async delete(key: Key): Promise<boolean> {
    return this.entries.delete(keyOf(key));
  }

  async keys(): Promise<{ url: string }[]> {
    return [...this.entries.keys()].map(url => ({ url }));
  }

  async match(key: Key): Promise<Response | undefined> {
    return this.entries.get(keyOf(key))?.clone();
  }

  async put(key: Key, response: Response): Promise<void> {
    this.entries.set(keyOf(key), response);
  }
}

function load() {
  const listeners = new Map<string, Listener>();
  const stores = new Map<string, FakeCache>();
  const server = new Map<string, Answer>();
  const asked: string[] = [];
  const clock = { now: 0 };

  async function network(input: Key): Promise<Response> {
    const url = keyOf(input);

    asked.push(new URL(url).pathname);

    return (server.get(new URL(url).pathname) ?? (async () => new Response('file')))();
  }

  const caches = {
    delete: async (name: string) => stores.delete(name),
    keys: async () => [...stores.keys()],
    open: async (name: string) => {
      const store = stores.get(name) ?? new FakeCache(network);

      stores.set(name, store);

      return store;
    }
  };
  const shown: { options: Record<string, unknown>; title: string }[] = [];
  const opened: string[] = [];
  const windows: AppWindow[] = [];
  const self = {
    addEventListener: (type: string, listener: Listener) => listeners.set(type, listener),
    clients: {
      claim: async () => undefined,
      matchAll: async () => windows,
      openWindow: async (url: string) => {
        opened.push(url);
      }
    },
    location: new URL(`${ORIGIN}/sw.js`),
    registration: {
      showNotification: async (title: string, options: Record<string, unknown>) => {
        shown.push({ options, title });
      }
    },
    skipWaiting: () => undefined
  };

  runInNewContext(SOURCE, { caches, Date: { now: () => clock.now }, fetch: network, Response, self, URL });

  /** Sends one event; returns what it handed to `waitUntil`, which grows for as long as the worker is still working. */
  function dispatch(type: string, event: Record<string, unknown>): Promise<unknown>[] {
    const pending: Promise<unknown>[] = [];
    const listener = listeners.get(type);

    if (!listener) {
      throw new Error(`The worker does not listen for ${type}`);
    }

    listener({ ...event, waitUntil: (promise: Promise<unknown>) => pending.push(promise) });

    return pending;
  }

  /** Waits out everything the worker is still doing, including work it only hands over once a response is on its way. */
  async function drain(pending: Promise<unknown>[]): Promise<void> {
    for (let seen = -1; seen !== pending.length; ) {
      seen = pending.length;
      await Promise.all(pending);
    }
  }

  /** A request as the browser would send it; `undefined` when the worker leaves it to the browser. */
  async function request(path: string, options: { method?: string; mode?: string } = {}): Promise<Error | Response | undefined> {
    let responded: Promise<Response> | undefined;
    const pending = dispatch('fetch', {
      request: { method: options.method ?? 'GET', mode: options.mode ?? 'navigate', url: path.startsWith('http') ? path : at(path) },
      respondWith: (response: Promise<Response>) => {
        responded = response;
      }
    });
    const response = responded ? await responded.catch((error: unknown) => error as Error) : undefined;

    await drain(pending);

    return response;
  }

  return {
    asked,
    clock,
    /** Any other event, the way the browser would send it. */
    event: (type: string, payload: Record<string, unknown>) => drain(dispatch(type, payload)),
    message: (data: Record<string, unknown>) => drain(dispatch('message', { data })),
    opened,
    request,
    server,
    shown,
    stored: (cache: string) => [...(stores.get(cache)?.entries.keys() ?? [])].map(url => new URL(url).pathname),
    windows
  };
}

type AppWindow = { focus: () => Promise<void>; focused: boolean; navigate: (url: string) => Promise<void>; navigated: string[]; url: string };

/** The app, open in a window on some page of this site. */
function appWindow(url: string): AppWindow {
  const window: AppWindow = {
    focus: async () => {
      window.focused = true;
    },
    focused: false,
    navigate: async (to: string) => {
      window.navigated.push(to);
    },
    navigated: [],
    url
  };

  return window;
}

function tapped(url: string): Record<string, unknown> {
  return { notification: { close: () => undefined, data: { url } } };
}

describe('the worker and a push', () => {
  it('shows what arrives, replacing an older reminder rather than stacking beside it', async () => {
    const worker = load();

    await worker.event('push', { data: { json: () => ({ body: 'Dos minutos.', title: 'Tu quincena ha terminado', url: at('/check-in') }) } });

    expect(worker.shown).toEqual([
      { options: { body: 'Dos minutos.', data: { url: at('/check-in') }, icon: '/icon', tag: 'check-in' }, title: 'Tu quincena ha terminado' }
    ]);
  });

  /* A browser that is told something and shows nothing may stop delivering to the site. */
  it('still shows something when a push cannot be read', async () => {
    const worker = load();

    await worker.event('push', {
      data: {
        json: () => {
          throw new SyntaxError('not JSON');
        }
      }
    });
    await worker.event('push', {});

    expect(worker.shown.map(notification => notification.title)).toEqual(['NutrIA', 'NutrIA']);
  });

  it('opens the page a notification is about, or brings the open app to it', async () => {
    const worker = load();

    await worker.event('notificationclick', tapped(at('/check-in')));
    expect(worker.opened).toEqual([at('/check-in')]);

    const open = appWindow(at('/plan'));

    worker.windows.push(open);
    await worker.event('notificationclick', tapped(at('/check-in')));

    expect(open).toMatchObject({ focused: true, navigated: [at('/check-in')] });
    expect(worker.opened).toHaveLength(1);
  });

  it('never sends somebody to another site, whatever the message says', async () => {
    const worker = load();

    await worker.event('push', { data: { json: () => ({ title: 'x', url: 'https://elsewhere.example/login' }) } });
    await worker.event('notificationclick', tapped('https://elsewhere.example/login'));

    expect(worker.shown[0]?.options).toMatchObject({ data: { url: at('/inicio') } });
    expect(worker.opened).toEqual([at('/inicio')]);
  });
});

describe('the offline worker', () => {
  it('names the same cache the page forgets', () => {
    expect(SOURCE).toContain(`const PAGES = '${OFFLINE_PAGES_CACHE}';`);
  });

  it('keeps the same screens the page draws as available offline', () => {
    const declared = SOURCE.match(/const OFFLINE_PATHS = (\[[^\]]*\]);/)?.[1] ?? '[]';

    expect(JSON.parse(declared.replaceAll("'", '"'))).toEqual([...OFFLINE_PATHS]);
  });

  it("keeps a meal's page read online, and fetches today's meals when refreshing", async () => {
    const worker = load();

    worker.server.set('/plan/comida/lunch-1', page());
    await worker.request('/plan/comida/lunch-1');
    expect(worker.stored(PAGES)).toEqual(['/plan/comida/lunch-1']);

    worker.server.set('/inicio', async () => new Response('<a href="/plan/comida/breakfast-1"></a><a href="/plan/comida/lunch-1"></a>'));
    worker.server.set('/plan', async () => new Response('"id":"breakfast-1","id":"lunch-1"'));
    await worker.message({ type: 'refresh' });

    expect(worker.stored(PAGES).sort()).toEqual(['/compra', '/inicio', '/plan', '/plan/comida/breakfast-1', '/plan/comida/lunch-1']);
    // Kept already, so not fetched a second time.
    expect(worker.asked.filter(path => path === '/plan/comida/lunch-1')).toHaveLength(1);
  });

  it('drops the pages of meals the plan no longer has', async () => {
    const worker = load();

    worker.server.set('/plan/comida/old-1', page());
    await worker.request('/plan/comida/old-1');
    worker.server.set('/inicio', async () => new Response('<a href="/plan/comida/new-1"></a>'));
    worker.server.set('/plan', async () => new Response('"id":"new-1"'));
    await worker.message({ type: 'refresh' });

    expect(worker.stored(PAGES).filter(path => path.startsWith('/plan/comida/'))).toEqual(['/plan/comida/new-1']);
  });

  it('keeps the shopping list and the files it names, and opens it when the network is gone', async () => {
    const worker = load();

    worker.server.set('/compra', page('/_next/static/chunks/list.js', '/_next/static/css/list.css'));
    expect(await worker.request('/compra')).toBeInstanceOf(Response);
    expect(worker.stored(PAGES)).toEqual(['/compra']);
    expect(worker.stored(ASSETS).sort()).toEqual(['/_next/static/chunks/list.js', '/_next/static/css/list.css']);

    worker.server.set('/compra', unreachable);
    worker.server.set('/_next/static/chunks/list.js', unreachable);

    const copy = await worker.request('/compra');

    expect(copy).toBeInstanceOf(Response);
    expect(await (copy as Response).text()).toContain('list.js');
    expect(await worker.request('/_next/static/chunks/list.js', { mode: 'no-cors' })).toBeInstanceOf(Response);
  });

  it('reads a file named inside the flight data, where it has no /_next/ prefix', async () => {
    const worker = load();

    worker.server.set('/inicio', async () => new Response('<script>self.__next_f.push([1,"2:I[1,[\\"static/chunks/today.js\\"]]"])</script>'));
    await worker.request('/inicio');

    expect(worker.stored(ASSETS)).toEqual(['/_next/static/chunks/today.js']);
  });

  it('drops every copy the moment one of these pages answers with a redirect', async () => {
    const worker = load();

    worker.server.set('/inicio', page());
    worker.server.set('/compra', page());
    await worker.request('/inicio');
    await worker.request('/compra');
    expect(worker.stored(PAGES)).toHaveLength(2);

    // Signed out elsewhere, or the session expired: the proxy sends them to sign in.
    worker.server.set('/compra', redirected);
    await worker.request('/compra');
    expect(worker.stored(PAGES)).toEqual([]);

    worker.server.set('/inicio', unreachable);
    expect(await worker.request('/inicio')).toBeInstanceOf(TypeError);
  });

  it('keeps the last good copy when the server answers with a failure', async () => {
    const worker = load();

    worker.server.set('/compra', page('/_next/static/chunks/good.js'));
    await worker.request('/compra');
    worker.server.set('/compra', async () => new Response('broken', { status: 500 }));
    await worker.request('/compra');
    worker.server.set('/compra', unreachable);

    expect(await ((await worker.request('/compra')) as Response).text()).toContain('good.js');
  });

  it('leaves every other request to the browser', async () => {
    const worker = load();

    expect(await worker.request('/perfil')).toBeUndefined();
    expect(await worker.request('/progreso')).toBeUndefined();
    expect(await worker.request('/plan/historial')).toBeUndefined();
    expect(await worker.request('/api/v1/shopping-lists/active', { mode: 'cors' })).toBeUndefined();
    expect(await worker.request('/compra', { method: 'POST' })).toBeUndefined();
    // A client-side navigation fetches the page's data, not the page: left alone.
    expect(await worker.request('/compra?_rsc=1', { mode: 'cors' })).toBeUndefined();
    expect(await worker.request('https://elsewhere.test/_next/static/chunks/x.js', { mode: 'no-cors' })).toBeUndefined();
    expect(worker.asked).toEqual([]);
  });

  it('opens on today when the installed app starts with no network, and only if a copy exists', async () => {
    const worker = load();

    worker.server.set('/', unreachable);
    worker.server.set('/en', unreachable);
    expect(await worker.request('/')).toBeInstanceOf(TypeError);

    worker.server.set('/inicio', page());
    await worker.request('/inicio');

    const opening = (await worker.request('/en')) as Response;

    expect(opening.status).toBe(302);
    expect(opening.headers.get('Location')).toBe(at('/inicio'));
  });

  it('refreshes both copies when asked, at most once a minute, and again as the app is put away', async () => {
    const worker = load();

    worker.server.set('/inicio', page());
    worker.server.set('/compra', page());

    await worker.message({ type: 'refresh' });
    expect(worker.stored(PAGES).sort()).toEqual(['/compra', '/inicio', '/plan']);

    worker.clock.now += 30_000;
    await worker.message({ type: 'refresh' });
    expect(worker.asked.filter(path => path === '/compra')).toHaveLength(1);

    await worker.message({ force: true, type: 'refresh' });
    expect(worker.asked.filter(path => path === '/compra')).toHaveLength(2);
  });

  it('stores nothing fetched under a session that ended while it was in flight', async () => {
    const worker = load();
    let answer: (response: Response) => void = () => undefined;

    worker.server.set('/inicio', () => new Promise<Response>(resolve => (answer = resolve)));
    worker.server.set('/compra', page());

    const refreshing = worker.message({ type: 'refresh' });

    await worker.message({ type: 'forget' });
    answer(new Response('<html>the previous person</html>'));
    await refreshing;

    expect(worker.stored(PAGES)).toEqual([]);
  });

  it('holds only the files the stored pages still name', async () => {
    const worker = load();

    worker.server.set('/compra', page('/_next/static/chunks/old.js'));
    await worker.request('/compra');
    worker.server.set('/compra', page('/_next/static/chunks/new.js'));
    await worker.request('/compra');

    expect(worker.stored(ASSETS)).toEqual(['/_next/static/chunks/new.js']);
  });
});

describe('the page asking the worker', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('reaches a worker that does not control the page yet, as on the first visit', async () => {
    const postMessage = vi.fn();

    vi.stubEnv('NODE_ENV', 'production');
    vi.stubGlobal('navigator', { serviceWorker: { controller: null, ready: Promise.resolve({ active: { postMessage } }) } });
    await refreshOfflineCopies();

    expect(postMessage).toHaveBeenCalledWith({ force: false, type: 'refresh' });
  });

  it('lists the screens with a copy, by path', async () => {
    vi.stubGlobal('caches', {
      open: async () => ({ keys: async () => [{ url: 'https://nutria.test/inicio' }, { url: 'https://nutria.test/plan/comida/a-1' }] })
    });

    expect([...(await storedPages())]).toEqual(['/inicio', '/plan/comida/a-1']);
  });

  it('forgets without waiting for a worker that never came', async () => {
    const deleted = vi.fn(async () => true);

    vi.stubGlobal('navigator', { serviceWorker: { getRegistration: async () => undefined, ready: new Promise(() => undefined) } });
    vi.stubGlobal('caches', { delete: deleted });
    await forgetOfflineCopies();

    expect(deleted).toHaveBeenCalledWith(OFFLINE_PAGES_CACHE);
  });
});
