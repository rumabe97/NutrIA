import { describe, expect, it } from 'vitest';

import { accountQuerySchema, feedbackQuerySchema } from 'core/entities/AdminQuery';

import { apiSearch, readTableQuery, tableHref } from './tableQuery';

describe('readTableQuery', () => {
  it('gives the API’s defaults for an empty address', () => {
    expect(readTableQuery(accountQuerySchema, {})).toEqual({ dir: 'desc', offset: 0, size: 25, sort: 'createdAt' });
  });

  it('keeps what the API accepts', () => {
    expect(readTableQuery(accountQuerySchema, { activated: 'no', dir: 'asc', offset: '50', q: 'ana', size: '50', sort: 'email' })).toEqual({
      activated: 'no',
      dir: 'asc',
      offset: 50,
      q: 'ana',
      size: 50,
      sort: 'email'
    });
  });

  it('drops a value the API would refuse, instead of failing the page', () => {
    expect(readTableQuery(accountQuerySchema, { activated: 'maybe', offset: '-3', size: '500', sort: 'password' })).toEqual({
      dir: 'desc',
      offset: 0,
      size: 25,
      sort: 'createdAt'
    });
  });

  it('reads the first of a repeated parameter and ignores ones it does not know', () => {
    expect(readTableQuery(feedbackQuerySchema, { abierta: 'x', period: '7', state: ['seen', 'waiting'] })).toMatchObject({ state: 'seen' });
  });

  it('treats a blank search as none', () => {
    expect(readTableQuery(accountQuerySchema, { q: '   ' }).q).toBeUndefined();
  });
});

describe('apiSearch', () => {
  it('writes every value that is set, in a stable order', () => {
    expect(apiSearch({ dir: 'desc', offset: 0, q: undefined, sort: 'createdAt' })).toBe('dir=desc&offset=0&sort=createdAt');
  });

  it('encodes the search text', () => {
    expect(apiSearch({ q: 'ana@example.com & co' })).toBe('q=ana%40example.com+%26+co');
  });
});

describe('tableHref', () => {
  it('changes what it is told and keeps the rest, repeated values included', () => {
    expect(tableHref('/admin/cuentas', { abierta: ['a', 'b'], period: '7', sort: 'email' }, { dir: 'asc', sort: 'plans' })).toBe(
      '/admin/cuentas?abierta=a&abierta=b&period=7&dir=asc&sort=plans'
    );
  });

  it('removes a parameter set to undefined', () => {
    expect(tableHref('/admin/buzon', { offset: '25', q: 'hola' }, { offset: undefined })).toBe('/admin/buzon?q=hola');
  });

  it('gives the bare path when nothing is left', () => {
    expect(tableHref('/admin/buzon', { offset: '25' }, { offset: undefined })).toBe('/admin/buzon');
  });
});
