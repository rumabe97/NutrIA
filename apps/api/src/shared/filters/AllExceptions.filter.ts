import { ArgumentsHost, Catch, HttpException, HttpStatus, Logger } from '@nestjs/common';

import {
  AccountNotActivatedError,
  ConflictError,
  DatabaseOperationError,
  InputParseError,
  NotFoundError,
  OnboardingIncompleteError,
  QuotaExceededError,
  SafetyViolationError,
  UnauthorizedError
} from 'core/entities/Error';

import { ErrorReporter } from '../observability/ErrorReporter.js';

import type { ExceptionFilter } from '@nestjs/common';
import type { Request, Response } from 'express';

type ErrorBody = {
  readonly code: string;
  readonly fieldErrors?: Record<string, readonly string[]>;
  readonly message: string;
  /** ISO date an exhausted allowance renews, when it renews on a date. */
  readonly retryAt?: string;
  readonly statusCode: number;
};

/**
 * The single translation point from domain errors to HTTP.
 *
 * Two rules it exists to enforce:
 *
 *  1. **Nothing internal escapes.** Driver errors carry connection strings,
 *     Zod issues carry the shape of the database, and stack traces carry paths.
 *     An unrecognised error becomes a bare 500 with a generic message; the real
 *     one goes to the log.
 *
 *  2. **`code` is stable, `message` is not.** The frontend switches on `code` to
 *     pick the copy it shows, so messages can be reworded without breaking it.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  /** Optional so a test can stand the filter up without the reporter. */
  constructor(private readonly reporter?: ErrorReporter) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const body = this.toBody(exception);

    if (body.statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
      // The route, not the URL: a path carries ids, and an id is a person.
      const request = http.getRequest<Request>();
      // express annotates the matched route on the request; its own types leave
      // it loose, and the pattern — not the URL — is the whole point: a path
      // carries ids, and an id is a person.
      const route = (request as { route?: { path?: string } }).route?.path ?? 'unmatched';

      this.reporter?.report(exception, `${request.method} ${route}`);
    }

    response.status(body.statusCode).json(body);
  }

  private toBody(exception: unknown): ErrorBody {
    if (exception instanceof NotFoundError) {
      return { code: 'NOT_FOUND', message: exception.message, statusCode: HttpStatus.NOT_FOUND };
    }

    if (exception instanceof ConflictError) {
      return { code: 'CONFLICT', message: exception.message, statusCode: HttpStatus.CONFLICT };
    }

    if (exception instanceof InputParseError) {
      return { code: 'INVALID_INPUT', fieldErrors: exception.fieldErrors, message: exception.message, statusCode: HttpStatus.UNPROCESSABLE_ENTITY };
    }

    if (exception instanceof AccountNotActivatedError) {
      // 409 like an unfinished profile: the account's state conflicts with the
      // request, and the person is meant to understand it and where to go.
      return { code: 'ACCOUNT_NOT_ACTIVATED', message: 'Tu cuenta todavía no está activada.', statusCode: HttpStatus.CONFLICT };
    }

    if (exception instanceof OnboardingIncompleteError) {
      // 409, not 404: the account state conflicts with the request, and unlike
      // an authorisation denial this one is meant to be understood. The client
      // switches on `code` and sends the person back to their resume step.
      return { code: 'ONBOARDING_INCOMPLETE', message: 'Termina tu perfil antes de continuar.', statusCode: HttpStatus.CONFLICT };
    }

    if (exception instanceof QuotaExceededError) {
      // 429, the status for "not now": the request was fine, the allowance is
      // spent. `kind` in the message lets the client say which, `retryAt` when.
      return { code: 'QUOTA_EXCEEDED', message: exception.kind, statusCode: HttpStatus.TOO_MANY_REQUESTS, ...(exception.nextAt ? { retryAt: exception.nextAt } : {}) };
    }

    if (exception instanceof SafetyViolationError) {
      // 422, not 500: the request was well-formed, the *content* was refused.
      // Logged at error level regardless — unsafe content reaching this point
      // means an upstream check let it through.
      this.logger.error(`Safety violation blocked: ${exception.violations.map(v => v.ingredientName).join(', ')}`);

      return { code: 'UNSAFE_CONTENT', message: exception.message, statusCode: HttpStatus.UNPROCESSABLE_ENTITY };
    }

    // Both of these deliberately become 404. See the denial rule in AGENTS.md.
    if (exception instanceof UnauthorizedError) {
      return { code: 'NOT_FOUND', message: 'Not found', statusCode: HttpStatus.NOT_FOUND };
    }

    if (exception instanceof DatabaseOperationError) {
      this.logger.error(exception.message);

      return { code: 'INTERNAL_ERROR', message: 'Algo ha ido mal. Inténtalo de nuevo.', statusCode: HttpStatus.INTERNAL_SERVER_ERROR };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      const message = typeof payload === 'string' ? payload : ((payload as { message?: string | string[] }).message ?? exception.message);

      return {
        code: status === HttpStatus.NOT_FOUND ? 'NOT_FOUND' : 'REQUEST_ERROR',
        message: Array.isArray(message) ? message.join(', ') : message,
        statusCode: status
      };
    }

    return { code: 'INTERNAL_ERROR', message: 'Algo ha ido mal. Inténtalo de nuevo.', statusCode: HttpStatus.INTERNAL_SERVER_ERROR };
  }
}
