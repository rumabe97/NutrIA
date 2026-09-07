import { Inject, Injectable } from '@nestjs/common';

import { PINO } from './pino.js';

import type { LoggerService } from '@nestjs/common';
import type { Logger } from 'pino';

type Level = 'debug' | 'error' | 'fatal' | 'info' | 'trace' | 'warn';

/**
 * Nest's `LoggerService` over pino, so `new Logger('Context').log(...)` anywhere in
 * the app lands on the same instance as request logging, with the same redaction.
 *
 * Nest appends the context as the last parameter, and for `error` and `fatal`
 * puts the stack before it: `(message, context)` or `(message, stack, context)`.
 * That convention is the whole of what this class knows about its caller.
 */
@Injectable()
export class PinoLoggerService implements LoggerService {
  constructor(@Inject(PINO) private readonly logger: Logger) {}

  debug(message: unknown, ...params: unknown[]): void {
    this.write('debug', message, params);
  }

  error(message: unknown, ...params: unknown[]): void {
    this.write('error', message, params);
  }

  fatal(message: unknown, ...params: unknown[]): void {
    this.write('fatal', message, params);
  }

  log(message: unknown, ...params: unknown[]): void {
    this.write('info', message, params);
  }

  verbose(message: unknown, ...params: unknown[]): void {
    this.write('trace', message, params);
  }

  warn(message: unknown, ...params: unknown[]): void {
    this.write('warn', message, params);
  }

  private write(level: Level, message: unknown, params: readonly unknown[]): void {
    const rest = [...params];
    const context = typeof rest.at(-1) === 'string' ? (rest.pop() as string) : undefined;
    const trace = (level === 'error' || level === 'fatal') && typeof rest.at(-1) === 'string' ? (rest.pop() as string) : undefined;
    const fields = { ...(context === undefined ? {} : { context }), ...(trace === undefined ? {} : { trace }) };

    if (message instanceof Error) {
      this.logger[level]({ ...fields, err: message }, message.message);

      return;
    }

    if (typeof message === 'object' && message !== null) {
      this.logger[level]({ ...fields, ...message });

      return;
    }

    this.logger[level](fields, String(message));
  }
}
