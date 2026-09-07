import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { NextFunction, Request, Response } from 'express';

type Middleware = (request: Request, response: Response, next: NextFunction) => void;
type Handler = (request: Request, response: Response) => Promise<void>;

const createApp = jest.fn<(app: { use: (middleware: Middleware) => void }) => Promise<unknown>>();

jest.unstable_mockModule('../config/CreateApp.js', () => ({ createApp }));

/**
 * The serverless entry point.
 *
 * One property matters and it is only observable under concurrency: the
 * *promise* is cached, not the resolved handler. Two requests arriving during a
 * cold start — which is exactly when requests arrive in pairs, because the
 * platform scales up on the first burst — would otherwise each begin their own
 * bootstrap, building two Nest applications and two database pools inside one
 * container.
 *
 * `createApp` is mocked; the express instance is real, because the error path
 * depends on express's own "call the out-callback with the error" behaviour
 * rather than on anything this file does.
 */
async function load(middleware: Middleware = (_request, _response, next) => next()): Promise<Handler> {
  jest.resetModules();
  createApp.mockReset();
  createApp.mockImplementation(app => {
    app.use(middleware);

    return Promise.resolve({});
  });

  const namespace = (await import('./index.js')) as { default: Handler };

  return namespace.default;
}

/** Enough of a response for express to run against, and an emitter so `close` fires. */
function fakeExchange(): { request: Request; response: Response } {
  const response = Object.assign(new EventEmitter(), {
    end: () => {
      response.emit('close');
    },
    setHeader: jest.fn()
  });

  return { request: { headers: {}, method: 'GET', url: '/' } as Request, response: response as unknown as Response };
}

describe('the serverless handler', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('builds the application once across concurrent cold-start requests', async () => {
    const handler = await load((_request, response) => {
      (response as unknown as { end: () => void }).end();
    });

    const first = fakeExchange();
    const second = fakeExchange();

    await Promise.all([handler(first.request, first.response), handler(second.request, second.response)]);

    expect(createApp).toHaveBeenCalledTimes(1);
  });

  it('rejects when the application passes an error out', async () => {
    const handler = await load((_request, _response, next) => {
      next(new Error('mounted middleware failed'));
    });

    const { request, response } = fakeExchange();

    await expect(handler(request, response)).rejects.toThrow('mounted middleware failed');
  });
});
