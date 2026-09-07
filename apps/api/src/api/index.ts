import 'reflect-metadata';

import express from 'express';

import { createApp } from '../config/CreateApp.js';

import type { Request, RequestHandler, Response } from 'express';

/**
 * Serverless function entry point.
 *
 * The Nest instance is built once and reused for the life of the container, so a
 * warm invocation costs nothing to start. Assembly itself lives in `createApp`,
 * shared with `main.ts` — see the note there for why neither entry owns the list.
 *
 * Note what is absent: no `listen`, and no `beforeExit` database close. The
 * platform owns the lifecycle, and closing the pool between invocations would
 * throw away the connection every warm request depends on.
 */
let handlerPromise: Promise<RequestHandler> | null = null;

async function bootstrap(): Promise<RequestHandler> {
  const expressApp = express();

  await createApp(expressApp);

  return expressApp;
}

export default async function handler(request: Request, response: Response): Promise<void> {
  // Cache the promise, not the resolved handler: two requests arriving during a
  // cold start would otherwise each begin their own bootstrap.
  handlerPromise ??= bootstrap();

  const app = await handlerPromise;

  await new Promise<void>((resolve, reject) => {
    // Express calls the out-callback only when *nothing* handled the request, so
    // waiting on it alone leaves this promise pending for every request that was
    // handled — which is all of them. `close` always fires. Settling on whichever
    // comes first is what keeps the returned promise a truthful signal rather
    // than one the platform happens not to depend on.
    response.once('close', resolve);

    app(request, response, (error?: unknown) => {
      if (error) {
        reject(error instanceof Error ? error : new Error(String(error)));

        return;
      }

      resolve();
    });
  });
}
