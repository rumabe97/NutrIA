import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { PinoLoggerService } from './PinoLoggerService.js';

import type { Logger } from 'pino';

type Sink = Record<'debug' | 'error' | 'fatal' | 'info' | 'trace' | 'warn', jest.Mock<(fields: object, message?: string) => void>>;

/**
 * What matters here is the convention Nest uses when it calls a `LoggerService`:
 * context last, and for `error` the stack just before it. Getting either wrong
 * means every log line either loses its context or logs the stack as a message.
 */
describe('PinoLoggerService', () => {
  let sink: Sink;
  let service: PinoLoggerService;

  beforeEach(() => {
    sink = { debug: jest.fn(), error: jest.fn(), fatal: jest.fn(), info: jest.fn(), trace: jest.fn(), warn: jest.fn() };
    service = new PinoLoggerService(sink as unknown as Logger);
  });

  it('takes the trailing string as the context', () => {
    service.log('Plan generated', 'PlanJobRunner');

    expect(sink.info).toHaveBeenCalledWith({ context: 'PlanJobRunner' }, 'Plan generated');
  });

  it('logs with no context when none is given', () => {
    service.warn('Pool thin');

    expect(sink.warn).toHaveBeenCalledWith({}, 'Pool thin');
  });

  it('separates the stack from the context on error', () => {
    service.error('Job failed', 'Error: boom\n    at run', 'PlanJobRunner');

    expect(sink.error).toHaveBeenCalledWith({ context: 'PlanJobRunner', trace: 'Error: boom\n    at run' }, 'Job failed');
  });

  it('does not mistake the context for a stack on other levels', () => {
    service.log('two strings', 'not-a-stack', 'Context');

    expect(sink.info).toHaveBeenCalledWith({ context: 'Context' }, 'two strings');
  });

  it('passes an Error through as err so pino serialises the stack', () => {
    const error = new Error('boom');

    service.error(error, 'Context');

    expect(sink.error).toHaveBeenCalledWith({ context: 'Context', err: error }, 'boom');
  });

  it('merges an object message into the fields', () => {
    service.log({ jobId: 'j1', step: 'SAVING_PLAN' }, 'PlanJobRunner');

    expect(sink.info).toHaveBeenCalledWith({ context: 'PlanJobRunner', jobId: 'j1', step: 'SAVING_PLAN' });
  });

  it('maps verbose to trace and fatal to fatal', () => {
    service.verbose('v');
    service.fatal('f');

    expect(sink.trace).toHaveBeenCalledWith({}, 'v');
    expect(sink.fatal).toHaveBeenCalledWith({}, 'f');
  });
});
