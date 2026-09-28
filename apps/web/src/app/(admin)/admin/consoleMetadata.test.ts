import { beforeEach, describe, expect, it, vi } from 'vitest';

import { consoleMetadata } from './consoleMetadata';

const serverApi = vi.fn<(path: string) => Promise<unknown>>();

vi.mock('lib/server-api', () => ({ serverApi: (path: string) => serverApi(path) }));
vi.mock('i18n/server', () => ({
  activeLocale: () => Promise.resolve('es-ES'),
  dictionaryFor: () => ({ errors: { notFoundTitle: 'Página no encontrada' }, pages: { '/admin/cuentas': { title: 'Cuentas' } } })
}));

/*
 * A console page's title is resolved even when the gate answers 404, so it must not
 * name the page to anybody but an admin (`0028`).
 */
describe('consoleMetadata', () => {
  beforeEach(() => {
    serverApi.mockReset();
  });

  it.each([
    ['no session', null],
    ['an ordinary account', { role: 'user' }]
  ])('gives %s the 404 title, naming nothing', async (_who, user) => {
    serverApi.mockResolvedValue(user);

    await expect(consoleMetadata('/admin/cuentas')).resolves.toEqual({ title: 'Página no encontrada' });
  });

  it("gives an admin the page's own title, asking the API who they are", async () => {
    serverApi.mockResolvedValue({ role: 'admin' });

    await expect(consoleMetadata('/admin/cuentas')).resolves.toEqual({ title: 'Cuentas' });
    expect(serverApi).toHaveBeenCalledWith('/users/me');
  });
});
